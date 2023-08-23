const vsbSelectors = {
  courses: ".accessible.ak_c.nav_link.link_criteria.title_font",
  result: ".accessible.ak_r.nav_link.link_results.title_font",
  searchbar: '#code_number',
  addCourseButton: '#addCourseButton',
  seats1: '#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2) > span:nth-child(3)',
  seats2: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(3) > td:nth-child(1)`,
  seats3: `#legend_box > div.course_box.be0 > div > div > div > label:nth-child(2) > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2)`
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
      const elHandle = await page.waitForSelector(seats3);
      const text1 = await elHandle.evaluate(el => el.textContent);

      course.state = text1.includes(course.courseCode)
        ? await matchingElements[0].evaluate(el => el.textContent)
        : await matchingElements[1].evaluate(el => el.textContent);
    } else {
      const elementHandle = await page.waitForSelector(seats_selector);
      course.state = await elementHandle.evaluate(el => el.textContent);
    }

    course.reformatState();
    // console.log(`${course.courseCode} | ${course.state}`);

    await page.waitForSelector(vsbSelectors.courses);
    await page.$eval(vsbSelectors.courses, el => el.click());

    const removeBoxSelector = `#requirements > div:nth-child(3) > div.courseDiv.bc${(i % 2) + 1}.bd${(i % 2) + 1} > div:nth-child(5) > a`;
    await page.waitForSelector(removeBoxSelector);
    await page.$eval(removeBoxSelector, el => el.click());
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

module.exports = {
  updateCourseStates
};