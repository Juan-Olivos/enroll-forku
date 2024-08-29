const puppeteer = require("puppeteer");
const Course = require("./modules/course");
const readline = require("readline");
const { ppyLogin, duoLogin } = require("./modules/login");
const { enroll } = require("./modules/rem");
const { updateCourseStates } = require("./modules/vsb");
const { sendGmailNotification } = require("./modules/notifications");
require("dotenv").config();

(async () => {
  // Prompt user for course catalog codes
  let listOfCourses = await promptCourses();

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  //SU 2024 URL
  const VSB_url =
    "https://schedulebuilder.yorku.ca/vsb/criteria.jsp?access=0&lang=en&tip=1&page=results&scratch=0&term=2024102119&sort=none&filters=iiiiiiii&bbs=&ds=&cams=0_1_2_3_4_5_6&locs=any";

  await page.goto(VSB_url);

  try {
    // Log in to Passport York and Duo Security
    await ppyLogin(page);
    console.log("Please Two-Factor Authenticate within 90 seconds.");
    // await new Promise((resolve) => setTimeout(resolve, 60000)); // 1 minute  
  }
  catch (error) {
    console.log("Login error:", error);
    await browser.close();
    return;
  }

  // Continously check if course seats are Full or Available, and enroll in Available courses.
  // To prevent enrollment spam, Reserved courses are given a 3 hour cooldown.
  while (listOfCourses.length !== 0) {

    listOfCourses = await updateCourseStates(page, listOfCourses);

    const enroll_array = listOfCourses.filter(
      (course) => course.state === "Available" && course.cooldown <= 0
    );

    if (enroll_array.length != 0) {
      const previousLength = listOfCourses.length;
      const status = await enroll(browser, listOfCourses, enroll_array);
      
      if (status === 1) {
        console.log("Too many credits, ending execution.");
        await browser.close();
        return;
      }
      
      // Check if any courses were successfully enrolled
      if (listOfCourses.length < previousLength) {
        
        const enrolledCourses = enroll_array.filter(course => !listOfCourses.includes(course));
        await sendGmailNotification(enrolledCourses);
      }
      
      if (listOfCourses.length === 0) {
        break;
      }
    } else {
      console.log("All courses are full or on cooldown.");
    }


    decrementCooldowns(listOfCourses);

    await new Promise((resolve) => setTimeout(resolve, 300000)); // 5 minutes
    await page.reload();
  }

  console.log("Finished!");
  await browser.close();
})();

/* Asks user for the course catalog codes to enroll in */
async function promptCourses() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      "Please enter the course catalog codes separated by a space:\n",
      (input) => {
        rl.close();
        const catalogCode = input.trim().split(" ");
        const courses = catalogCode.map((code) => new Course(code));
        resolve(courses);
      }
    );
  });
}

function decrementCooldowns(listOfCourses) {
  for (const course of listOfCourses) {
    if (course.cooldown > 0) {
      course.cooldown--;
    }
  }
}
