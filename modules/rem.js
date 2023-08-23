const remSelectors = {
  addCourse: 'input[name="5.1.27.1.23"]',
  catalogueInput: 'input[name="5.1.27.7.7"]',
  catalogueSubmit: 'input[name="5.1.27.7.9"]',
  confirmButton: ['input[name="5.1.27.15.17"]', 'input[name="5.1.27.11.11"]'],
  courseName:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(4) > td:nth-child(2) > span",
  result:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(2) > span > font > b",
  reason:
    "body > form > div:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(2) > td:nth-child(2) > span > font > b",
  continueButton: ['input[name="5.1.27.27.11"]', 'input[name="5.1.27.19.9"]'],
};

async function enroll(browser, listOfCourses, enroll_array) {
  const page = await createNewPage(browser);

  for (let i = 0; i < enroll_array.length; i++) {
    const course = enroll_array[i];
    console.log(`Attempting to enroll ${course.courseCode}. Please wait...`);
    await page.waitForSelector(remSelectors.addCourse);
    await page.click(remSelectors.addCourse);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await page.type(remSelectors.catalogueInput, course.courseCode);
    await page.click(remSelectors.catalogueSubmit);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const courseNameHandle = await page.waitForSelector(remSelectors.courseName);

    let courseName = await courseNameHandle.evaluate((el) => el.textContent);

    try {
      await page.waitForSelector(remSelectors.confirmButton[0], { timeout: 5000, });
      await page.click(remSelectors.confirmButton[0]);
    } catch (error) {
      await page.waitForSelector(remSelectors.confirmButton[1]);
      await page.click(remSelectors.confirmButton[1]);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const resultHandle = await page.waitForSelector(remSelectors.result);
    let result = await resultHandle.evaluate((el) => el.textContent);
    result = result.trim();

    if (result === "The course has been  successfully added.") {
      console.log(`${courseName}(${course.courseCode}) has been successfully added.`);
      listOfCourses = listOfCourses.filter((c) => c.courseCode !== course.courseCode);
    } else {
      const reasonHandle = await page.waitForSelector(remSelectors.reason);
      let reason = await reasonHandle.evaluate((el) => el.textContent);
      reason = reason.trim();

      if (reason.includes("The course you are trying to add is full.")) {
        console.log(`${courseName}(${course.courseCode}) is full. Re-adding to queue.`);
        course.state = "Full";

      } else if (reason.includes("The spaces in this course are reserved.")) {
        course.state = "Reserved";
        course.applyEnrollmentCooldown();
        console.log(`${courseName}(${course.courseCode}) is reserved. Re-adding to queue with 2 hour cooldown.`);

      } else if (reason.includes("You are currently enrolled in this course.")) {
        console.log(`${courseName}(${course.courseCode}) has already been added. Removing from queue.`);
        listOfCourses = listOfCourses.filter((c) => c.courseCode !== course.courseCode);

      } else if (reason.includes("this course was not added because allowable credits")) {
        console.log(`${courseName}(${course.courseCode}) has NOT been added because you are full on allowable credits for this session.`);
        return -1;

      } else {
        console.log(`Failed to enroll ${courseName}(${course.courseCode}) due to unknown reason of:\n${reason}`);
      }
    }

    try {
      await page.waitForSelector(remSelectors.continueButton[0], { timeout: 5000, });
      await page.click(remSelectors.continueButton[0]);
    } catch (error) {
      await page.waitForSelector(remSelectors.continueButton[1]);
      await page.click(remSelectors.continueButton[1]);
    }
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
