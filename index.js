const puppeteer = require('puppeteer');
const Course = require('./course');
const readline = require('readline');
const fs = require('fs');
const UsedDuoCodeException = require('./exception');
require('dotenv').config();

(async () => {
  let listOfCourses = await promptCourses();
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-dev-shm-usage',
  ]
  });

  const page = await browser.newPage();
 
  //FW2023-2024 URL
  const VSB_url = 'https://schedulebuilder.yorku.ca/vsb/criteria.jsp?access=0&lang=en&tip=1&page=results&scratch=0&term=2023102119&sort=none&filters=iiiiiiii&bbs=&ds=&cams=0_1_2_3_4_5_6_7_8&locs=any';

  const cookiesFilePath = './cookies.json';
  if (fs.existsSync(cookiesFilePath)) {
    const cookies = require(cookiesFilePath);
    // Load page with old cookies.
    await page.setCookie(...cookies);
  }

  await page.goto(VSB_url);

  // If cookies expired, relogin.
  if (!page.url().includes("schedulebuilder")) {

    await ppyLogin(page);
    try {
      await duoLogin(page);
    } catch (error) {
      console.log(error);
      await browser.close();
      return;
    }
    

    const currentCookies = await page.cookies();

    // Save cookies
    fs.writeFileSync(cookiesFilePath, JSON.stringify(currentCookies));
  } else {
    console.log("sleeping for 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  while (listOfCourses.length !== 0) {

    await updateCourseStates(page, listOfCourses);

    const enroll_array = listOfCourses.filter(course => course.state === "Available" && course.cooldown <= 0);

    if (enroll_array.length != 0) {
      listOfCourses = await enroll(browser, listOfCourses, enroll_array);
    } else {
      console.log("All courses are full or on cooldown.");  
    }
    
    if (listOfCourses === -1) {
      console.log('Too many credits, ending execution.');
      return;
    }

    decrementCooldowns(listOfCourses);

    await new Promise(resolve => setTimeout(resolve, 60000));
    await page.reload();
}

  console.log("Finished!");
  await browser.close();
})();


async function ppyLogin(page) {

  console.log("PPY: logging in...");
  await page.waitForSelector("#mli");
  await page.type('#mli', process.env.PPY_USERNAME);
  await page.type('#password', process.env.PPY_PASSWORD);
  
  const button = 'body > div.container.page-content > div.row > div:nth-child(1) > form > div:nth-child(2) > div.col-md-8 > p:nth-child(2) > input';
  await page.waitForSelector(button);
  await page.click(button);

  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("done with PPY login");
}

async function duoLogin(page) {
  console.log("Signing into duo...");

  const frames = page.frames();
  const duoF = frames[1];
  if (duoF) {
      await duoF.waitForSelector('#login-form > div:nth-child(17) > div > label > input[type=checkbox]');
      await duoF.click("#login-form > div:nth-child(17) > div > label > input[type=checkbox]"); // remember 30 days
      await duoF.$eval('#passcode', el => el.click());
      await duoF.$eval('.passcode-input', (el, duocode) => { el.value = duocode }, process.env.DUOCODE);
      await duoF.$eval('#passcode', el => el.click());
  }

  console.log("sleeping for 20 seconds...");
  await new Promise(resolve => setTimeout(resolve, 20000));

  if(!page.url().includes("schedulebuilder")) {
    throw new UsedDuoCodeException();
  }

  console.log("done with DUO login");
}

/* Asks user for the course catalog codes to enroll in */
async function promptCourses() {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
  });

  return new Promise((resolve, reject) => {
      rl.question('Please enter the course catalog codes separated by a space:\n', (input) => {
          rl.close();
          const courseCodes = input.trim().split(' ');
          const courses = courseCodes.map(code => new Course(code));
          resolve(courses);
      });
  });
}

const vsbSelectors = {
  courses: ".accessible.ak_c.nav_link.link_criteria.title_font",
  result: ".accessible.ak_r.nav_link.link_results.title_font",
  searchbar: '#code_number',
  addCourseButton: '#addCourseButton',
  seats1: '#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2) > span:nth-child(3)',
  seats2: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(3) > td:nth-child(1)`
};

/* Visits VSB to map each Course with either 'Full' or 'Available' */
async function updateCourseStates(page, listOfCourses) {
  for (let i = 0; i < listOfCourses.length; i++) {
    const course = listOfCourses[i];

    await page.waitForSelector(vsbSelectors.courses);
    await page.$eval(vsbSelectors.courses, el => el.click());

    await page.waitForSelector(vsbSelectors.searchbar);
    await page.$eval(vsbSelectors.searchbar, el => el.value = '');
    await page.type(vsbSelectors.searchbar, course.courseCode);

    await page.waitForSelector(vsbSelectors.addCourseButton);
    await page.$eval(vsbSelectors.addCourseButton, el => el.click());

    const seats_selector = course.courseCode.charAt(course.courseCode.length - 1) === '1'
      ? vsbSelectors.seats1
      : vsbSelectors.seats2;

    await page.waitForSelector(seats_selector);
    const matchingElements = await page.$$(seats_selector);
    const numberOfMatches = matchingElements.length;

    if (numberOfMatches > 1) {
      console.log("2 matches! Extracting right one...");
      const elHandle = await page.waitForSelector("#legend_box > div.course_box.be0 > div > div > div > label:nth-child(2) > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2)");
      const text1 = await elHandle.evaluate(el => el.textContent);

      course.state = text1.includes(course.courseCode)
        ? await matchingElements[0].evaluate(el => el.textContent)
        : await matchingElements[1].evaluate(el => el.textContent);
    } else {
      const elementHandle = await page.waitForSelector(seats_selector);
      course.state = await elementHandle.evaluate(el => el.textContent);
    }

    course.reformatState();
    console.log(`${course.courseCode} | ${course.state}`);

    await page.waitForSelector(vsbSelectors.courses);
    await page.$eval(vsbSelectors.courses, el => el.click());

    const requirementsSelector = `#requirements > div:nth-child(3) > div.courseDiv.bc${(i % 2) + 1}.bd${(i % 2) + 1} > div:nth-child(5) > a`;
    await page.waitForSelector(requirementsSelector);
    await page.$eval(requirementsSelector, el => el.click());
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

const remSelectors = {
  addCourse: 'input[name="5.1.27.1.23"]',
  catalogueInput: 'input[name="5.1.27.7.7"]',
  catalogueSubmit: 'input[name="5.1.27.7.9"]',
  confirmButton: ['input[name="5.1.27.15.17"]','input[name="5.1.27.11.11"]'],
  courseName: 'body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(4) > td:nth-child(2) > span',
  result: 'body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(2) > span > font > b',
  reason: 'body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(2) > td:nth-child(2) > span > font > b',
  continueButton: ['input[name="5.1.27.27.11"]','input[name="5.1.27.19.9"]']
};

async function enroll(browser, listOfCourses, enroll_array) {
  const page = browser.pages()[2] ? browser.pages()[2]: await createNewPage(browser);

  for (let i = 0; i < enroll_array.length; i++) {
    const course = enroll_array[i];
    console.log(`Attempting to enroll ${course.courseCode}. Please wait...`);
    await page.waitForSelector(remSelectors.addCourse);
    await page.click(remSelectors.addCourse);
    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.type(remSelectors.catalogueInput, course.courseCode);
    await page.click(remSelectors.catalogueSubmit); 
    await new Promise(resolve => setTimeout(resolve, 5000));

    const courseNameHandle = await page.waitForSelector(remSelectors.courseName);
    let courseName = await courseNameHandle.evaluate(el => el.textContent);

    try {
      await page.waitForSelector(remSelectors.confirmButton[0], {timeout: 5000});
      await page.click(remSelectors.confirmButton[0]);
    } catch(error) {
      await page.waitForSelector(remSelectors.confirmButton[1]);
      await page.click(remSelectors.confirmButton[1]);
    }
    await new Promise(resolve => setTimeout(resolve, 10000));

    const resultHandle = await page.waitForSelector(remSelectors.result);
    let result = await resultHandle.evaluate(el => el.textContent);
    result = result.trim();

    if (result === 'The course has been  successfully added.') {
      console.log(`${courseName}(${course.courseCode}) has been successfully added.`);
      listOfCourses = listOfCourses.filter(c => c.courseCode !== course.courseCode);
    } else {
      const reasonHandle = await page.waitForSelector(remSelectors.reason);
      let reason = await reasonHandle.evaluate(el => el.textContent);
      reason = reason.trim();

      if (reason === 'The course you are trying to add is full. Please review the course availability on the York Courses Website, https://w2prod.sis.yorku.ca/Apps/WebObjects/cdm, for alternate choices and try again.') {
        console.log(`${courseName}(${course.courseCode}) is full. Re-adding to queue.`);
        course.state = "Full";
      } 
      else if (reason === 'The spaces in this course are reserved. Please contact the department for further information on receiving permission to add the course. To view the department contact  directory, please click on https://registrar.yorku.ca/enrol/course-contacts.') {
        course.state = "Reserved";
        course.cooldown = 180;
        console.log(`${courseName}(${course.courseCode}) is reserved. Re-adding to queue with 3 hour cooldown.`);
      } 
      else if (reason === 'You are currently enrolled in this course. Please recheck your enrolment information and try another option.') {
        console.log(`${courseName}(${course.courseCode}) has already been added. Removing from queue.`);
        listOfCourses = listOfCourses.filter(c => c.courseCode !== course.courseCode);
      }
      else if (reason.includes('this course was not added because allowable credits')) {
        console.log(`${courseName}(${course.courseCode}) has NOT been added because you are full on allowable credits for this session.`);
        return -1;
      }
      else {
        console.log(`Failed to enroll ${courseName}(${course.courseCode}) due to unknown reason of:\n${reason}`);
      }
    }

    try {
      await page.waitForSelector(remSelectors.continueButton[0], {timeout: 5000});
      await page.click(remSelectors.continueButton[0]);
    } catch(error) {
      await page.waitForSelector(remSelectors.continueButton[1]);
      await page.click(remSelectors.continueButton[1]);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return listOfCourses;
}

async function createNewPage(browser) {
  const REM_url = "https://wrem.sis.yorku.ca/Apps/WebObjects/REM.woa/wa/DirectAction/rem";
  const page = await browser.newPage();
  await page.goto(REM_url);

  await new Promise(resolve => setTimeout(resolve, 10000));
  await page.waitForSelector('select[name="5.5.1.27.1.11.0"]');
  await page.select('select[name="5.5.1.27.1.11.0"]', '3');
  await page.waitForSelector('input[type=submit]');
  await page.click('input[type=submit]');

  await new Promise(resolve => setTimeout(resolve, 10000));
  return page;
}

function decrementCooldowns(listOfCourses) {
  for(const course of listOfCourses) {
    if (course.cooldown > 0 ) {
      course.cooldown--;
    }
  }
}