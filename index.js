const puppeteer = require("puppeteer");
const chalk = require('chalk');
const Course = require("./modules/course");
const readline = require("readline");
const { enroll } = require("./modules/rem");
const { updateCourseStates, addNameToCourses } = require("./modules/vsb");
const { sendGmailNotification } = require("./modules/notifications");
const { checkEnvVariables } = require("./modules/configCheck");
require("dotenv").config();

(async () => {
  console.log(chalk.blue('=== York University Course Enrollment Bot ===\n'));

  console.log('Initializing...\n');

  checkEnvVariables();

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

  await addNameToCourses(page, listOfCourses);

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
      const currentTime = new Date();
      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Toronto'
      };
      console.log(`All courses are full or on cooldown. ${currentTime.toLocaleString('en-US', options)}`);
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
