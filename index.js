const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const chalk = require('chalk');
const Course = require("./modules/course");
const readline = require("readline");
const { TimeoutError } = require('puppeteer');
const { enroll } = require("./modules/rem");
const { updateCourseStates, addNameToCourses } = require("./modules/vsb");
const { sendGmailNotification, sendSuccessfulEnrolmentGmail, sendErrorGmail} = require("./modules/notifications");
const { checkEnvVariables } = require("./modules/configCheck");
require("dotenv").config();

const WAIT_INTERVAL = 300000; // 5 minutes
const MAINTENANCE_WAIT_TIME = 900000; // 15 minutes
const MAX_RETRIES = 3;

(async () => {
  console.log(chalk.blue('=== York University Course Enrollment Bot ===\n'));

  console.log('Initializing...\n');

  checkEnvVariables();

  // Prompt user for course catalog codes
  let listOfCourses = await promptCourses();

  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  await addNameToCoursesWithRetry(page, listOfCourses);

  let retryCount = 0;

  // Continously check if course seats are Full or Available, and enroll in Available courses.
  // To prevent enrollment spam, Reserved courses are given a 3 hour cooldown.
  while (listOfCourses.length !== 0) {
    try {
      listOfCourses = await updateCourseStates(page, listOfCourses);

      const enroll_array = listOfCourses.filter(
        (course) => course.state === "Available" && course.cooldown <= 0
      );

      if (enroll_array.length != 0) {
        const previousLength = listOfCourses.length;
        const status = await enroll(browser, listOfCourses, enroll_array);

        // Check if the user has reached the maximum allowable credits
        if (status === 1) {
          console.log("Too many credits, ending execution.");
          const body = "Ended execution because you are full on allowable credits for this session. Try dropping another course.";
          await sendErrorGmail(body);
          await browser.close();
          return;
        }

        // Check if any courses were successfully enrolled
        if (listOfCourses.length < previousLength) {

          const enrolledCourses = enroll_array.filter(course => !listOfCourses.includes(course));
          await sendSuccessfulEnrolmentGmail(enrolledCourses);
        }

        if (listOfCourses.length === 0) {
          break;
        }
      } else {
        logRemainingCourses(listOfCourses);
        logNoCoursesReady();
      }

      decrementReservedCooldowns(listOfCourses, WAIT_INTERVAL);

      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL)); // 5 minutes
      await page.reload();
      retryCount = 0;
    } catch (error) {
      // More than 3 consecutive failures is no longer likely to be a server maintenance issue; terminate the bot
      if (retryCount >= MAX_RETRIES) {
        console.log('Max retry limit reached. Terminating the bot.');
        await sendErrorGmail(error.message);
        throw error;
      }
      // Handles server maintenance @ 12:00 AM
      if (error instanceof TimeoutError) {
        decrementReservedCooldowns(listOfCourses, MAINTENANCE_WAIT_TIME);
        console.log(`Potential server maintenance detected. Waiting ${MAINTENANCE_WAIT_TIME/60000} minutes...`);
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES}.`);
        await new Promise((resolve) => setTimeout(resolve, MAINTENANCE_WAIT_TIME));
        retryCount++;

      } else {
        console.log('Unknown error occurred, terminating the bot.');
        await sendErrorGmail(error.message);
        throw error;
      }
    }
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

function decrementReservedCooldowns(listOfCourses, waitTime) {
  waitTime /= 1000; // Convert to seconds
  waitTime /= 60; // Convert to minutes

  for (const course of listOfCourses) {
    if (course.cooldown > 0) {
      course.cooldown -= waitTime;
    }
  }
}

function logNoCoursesReady() {
  const currentTime = new Date();
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Toronto'
  };
  console.log(`All courses are full or reserved and on cooldown. ${currentTime.toLocaleString('en-US', options)}`);
}

function logRemainingCourses(listOfCourses) {
  const remainingCourses = listOfCourses.map(course => course.catalogCode).join(' ');
  console.log(`Remaining courses: ${remainingCourses}`);
}

async function addNameToCoursesWithRetry(page, listOfCourses, retryCount = 0) {
  try {
    return await addNameToCourses(page, listOfCourses);
  } catch (error) {
    // More than 3 consecutive failures is no longer likely to be a server maintenance issue; terminate the bot
    if (retryCount >= MAX_RETRIES) {
      console.log('Max retry limit reached. Terminating the bot.');
      await sendErrorGmail(error.message);
      throw error;
    }
    // Handles server maintenance @ 12:00 AM
    if (error instanceof TimeoutError) {
      console.log(`Potential server maintenance detected. Waiting ${MAINTENANCE_WAIT_TIME/60000} minutes...`);
      console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES}.`);
      await new Promise((resolve) => setTimeout(resolve, MAINTENANCE_WAIT_TIME));
      return addNameToCoursesWithRetry(page, listOfCourses, retryCount + 1);
    } else {
      console.log('Unknown error occurred, terminating the bot.');
      await sendErrorGmail(error.message);
      throw error;
    }
  }
}
