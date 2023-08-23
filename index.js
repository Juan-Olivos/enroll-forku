const puppeteer = require("puppeteer");
const Course = require("./modules/course");
const readline = require("readline");
const fs = require("fs");
const { isLoggedOut, ppyLogin, duoLogin } = require("./modules/login");
const { enroll } = require("./modules/rem");
const { updateCourseStates } = require("./modules/vsb");
require("dotenv").config();

(async () => {
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

  //FW2023-2024 URL
  const VSB_url =
    "https://schedulebuilder.yorku.ca/vsb/criteria.jsp?access=0&lang=en&tip=1&page=results&scratch=0&term=2023102119&sort=none&filters=iiiiiiii&bbs=&ds=&cams=0_1_2_3_4_5_6_7_8&locs=any";

  const cookiesFilePath = "./cookies.json";
  if (fs.existsSync(cookiesFilePath)) {
    const cookies = require(cookiesFilePath);
    // Load page with old cookies.
    await page.setCookie(...cookies);
  }

  await page.goto(VSB_url);

  // If cookies expired, relogin.
  if (await isLoggedOut(page)) {
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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  while (listOfCourses.length !== 0) {

    if (await isLoggedOut(page)) {
      console.log("logging you back in...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await ppyLogin(page);
    }
    
    listOfCourses = await updateCourseStates(page, listOfCourses);

    const enroll_array = listOfCourses.filter(
      (course) => course.state === "Available" && course.cooldown <= 0
    );

    if (enroll_array.length != 0) {
      listOfCourses = await enroll(browser, listOfCourses, enroll_array);
    } else {
      console.log("All courses are full or on cooldown.");
    }

    if (listOfCourses === -1) {
      console.log("Too many credits, ending execution.");
      return;
    }

    decrementCooldowns(listOfCourses);

    await new Promise((resolve) => setTimeout(resolve, 60000));
    await page.reload();
    await new Promise((resolve) => setTimeout(resolve, 5000));
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
        const courseCodes = input.trim().split(" ");
        const courses = courseCodes.map((code) => new Course(code));
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
