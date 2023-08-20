const puppeteer = require('puppeteer');
const Course = require('./course');
const readline = require('readline');
const fs = require('fs');
const UsedDuoCodeException = require('./exception');
require('dotenv').config();

(async () => {

  const listOfCourses = await promptCourses();
  
  const browser = await puppeteer.launch({
    headless: 'new',
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
  }

  await updateCourseStates(page, listOfCourses);

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
      await duoF.click("#login-form > div:nth-child(17) > div > label > input[type=checkbox]")
      await duoF.$eval('#passcode', el => el.click());
      await duoF.$eval('.passcode-input', (el, duocode) => { el.value = duocode }, process.env.DUOCODE);
      await duoF.$eval('#passcode', el => el.click());
  }

  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

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

/* Visits VSB to map each Course with either 'Full' or 'Available' */
async function updateCourseStates(page, listOfCourses) {
  const courses_selector = ".accessible.ak_c.nav_link.link_criteria.title_font";
  const result_selector = ".accessible.ak_r.nav_link.link_results.title_font";
  const searchbar_selector = '#code_number';
  const addCourseButton_selector = '#addCourseButton';
  const seats_selector1 = '#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2) > span:nth-child(3)';
  const seats_selector2 = `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(3) > td:nth-child(1)`;

  for (let i = 0; i< listOfCourses.length; i++) {

    await page.waitForSelector(courses_selector);
    await page.$eval(courses_selector, el => el.click());
    await page.waitForSelector(searchbar_selector);
    await page.$eval(searchbar_selector, el => el.click());
    await page.$eval(searchbar_selector, (el, code) => { el.value = code }, listOfCourses[i].courseCode);
    await page.waitForSelector(addCourseButton_selector);
    await page.$eval(addCourseButton_selector, el => el.click());
    await page.waitForSelector(result_selector);
    await page.$eval(result_selector, el => el.click());
  
    let seats_selector = '';
    if (listOfCourses[i].courseCode.charAt(listOfCourses[i].courseCode.length-1) === '1') {
      seats_selector = seats_selector1;
    } else {
      seats_selector = seats_selector2;
    }

    const matchingElements = await page.$$(seats_selector);

    const numberOfMatches = matchingElements.length;
    if(numberOfMatches > 1) {
      console.log("2 matches! Extracting right one...");
      const elHandle = await page.waitForSelector("#legend_box > div.course_box.be0 > div > div > div > label:nth-child(2) > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2)");
      const text1 = await elHandle.evaluate(el => el.textContent);

      if (text1.includes(listOfCourses[i].courseCode)) {
        listOfCourses[i].state = await matchingElements[0].evaluate(el => el.textContent);
      } else {
        listOfCourses[i].state = await matchingElements[1].evaluate(el => el.textContent);
      }
    
    } else {
    
    const elementHandle = await page.waitForSelector(seats_selector);
    let text = await elementHandle.evaluate(element => element.textContent);
    
    listOfCourses[i].state = text;
    }
    listOfCourses[i].reformatState();
    console.log(`${listOfCourses[i].courseCode} | ${listOfCourses[i].state}`);
    
    await page.waitForSelector(courses_selector);
    await page.$eval(courses_selector, el => el.click());
    await page.waitForSelector(`#requirements > div:nth-child(3) > div.courseDiv.bc${(i%2)+1}.bd${(i%2)+1} > div:nth-child(5) > a`);
    await page.$eval(`#requirements > div:nth-child(3) > div.courseDiv.bc${(i%2)+1}.bd${(i%2)+1} > div:nth-child(5) > a`, el => el.click());
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}