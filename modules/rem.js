const remSelectors = {
  addACourse: 'input[title="Add a Course"]',
  catalogueInput: 'input[type="text"]',
  catalogueAdd: 'input[value="Add Course"]',
  yesButton: 'input[value="Yes"]',
  courseName:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(4) > td:nth-child(2) > span",
  result:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td:nth-child(2) > span > font > b",
  reason:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(2) > td:nth-child(2) > span > font > b",
  continueButton: `input[value="Continue"]`
};

async function enroll(browser, listOfCourses, enroll_array) {
  const page = await createNewPage(browser);

  for (let i = 0; i < enroll_array.length; i++) {
    const course = enroll_array[i];
    console.log(`Attempting to enroll ${course.catalogCode}. Please wait...`);
    await page.waitForSelector(remSelectors.addACourse);
    await page.click(remSelectors.addACourse);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await page.type(remSelectors.catalogueInput, course.catalogCode);
    await page.click(remSelectors.catalogueAdd);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const courseNameHandle = await page.waitForSelector(remSelectors.courseName);

    let courseName = await courseNameHandle.evaluate((el) => el.textContent);

    await page.waitForSelector(remSelectors.yesButton);
    await page.click(remSelectors.yesButton);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const resultHandle = await page.waitForSelector(remSelectors.result);
    let result = await resultHandle.evaluate((el) => el.textContent);
    result = result.trim();

    if (result.includes("successfully added")) {
      console.log(`${courseName}(${course.catalogCode}) has been successfully added.`);
      listOfCourses = listOfCourses.filter((c) => c.catalogCode !== course.catalogCode);
    } else {
      const reasonHandle = await page.waitForSelector(remSelectors.reason);
      let reason = await reasonHandle.evaluate((el) => el.textContent);
      reason = reason.trim();

      if (reason.includes("The course you are trying to add is full.")) {
        console.log(`${courseName}(${course.catalogCode}) is full. Re-adding to queue.`);
        course.state = "Full";

      } else if (reason.includes("The spaces in this course are reserved.")) {
        course.state = "Reserved";
        course.applyEnrollmentCooldown();
        console.log(`${courseName}(${course.catalogCode}) is reserved. Re-adding to queue with 3 hour cooldown.`);

      } else if (reason.includes("You are currently enrolled in this course.")) {
        console.log(`${courseName}(${course.catalogCode}) has already been added. Removing from queue.`);
        listOfCourses = listOfCourses.filter((c) => c.catalogCode !== course.catalogCode);

      } else if (reason.includes("this course was not added because allowable credits")) {
        console.log(`${courseName}(${course.catalogCode}) has NOT been added because you are full on allowable credits for this session.`);
        return -1;

      } else {
        console.log(`Failed to enroll ${courseName}(${course.catalogCode}) due to unknown reason of:\n${reason}`);
      }
    }

    await page.waitForSelector(remSelectors.continueButton, { timeout: 5000, });
    await page.click(remSelectors.continueButton);

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  await page.close();
  return listOfCourses;
}

async function createNewPage(browser) {
  const REM_url = "https://wrem.sis.yorku.ca/Apps/WebObjects/REM.woa/wa/DirectAction/rem";

  const page = await browser.newPage();
  await page.goto(REM_url);

  await new Promise((resolve) => setTimeout(resolve, 10000));
  await page.waitForSelector('select[name="5.5.1.27.1.11.0"]');
  await page.select('select[name="5.5.1.27.1.11.0"]', "3");
  await page.waitForSelector("input[type=submit]");
  await page.click("input[type=submit]");

  await new Promise((resolve) => setTimeout(resolve, 10000));
  return page;
}

module.exports = {
  enroll,
};
