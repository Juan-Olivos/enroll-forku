const vsbSelectors = {
  courses: ".accessible.ak_c.nav_link.link_criteria.title_font",
  result: ".accessible.ak_r.nav_link.link_results.title_font",
  searchbar: '#code_number',
  addCourseButton: '#addCourseButton',
  seatsTerm: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2)`,
  seatsTutLab: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(3) > td:nth-child(1)`,
  removeBox1: `#requirements > div:nth-child(3) > div.courseDiv.bc1.bd1 > div:nth-child(5) > a`,
  removeBox2: `#requirements > div:nth-child(3) > div.courseDiv.bc2.bd2 > div:nth-child(5) > a`
  // #requirements > div:nth-child(3) > div.courseDiv.bc1.bd1 > div:nth-child(5) > a
};

/* Visits VSB to map each Course with either 'Full' or 'Available' */
async function updateCourseStates(page, listOfCourses) {
  for (let i = 0; i < listOfCourses.length; i++) {
    const course = listOfCourses[i];

    try {
      await page.waitForSelector(vsbSelectors.result, { timeout: 5000 });
      await page.$eval(vsbSelectors.result, el => el.click());
    } catch (error) {
      // Ignoring error intentionally because the selector might not be found but that's okay
    }

    await page.waitForSelector(vsbSelectors.courses);
    await page.$eval(vsbSelectors.courses, el => el.click());

    await page.waitForSelector(vsbSelectors.searchbar);
    await page.$eval(vsbSelectors.searchbar, el => el.value = '');
    await page.type(vsbSelectors.searchbar, course.courseCode);

    await page.waitForSelector(vsbSelectors.addCourseButton);
    await page.$eval(vsbSelectors.addCourseButton, el => el.click());

    // If a courseCode ends with 1, it is a non-lab/tutorial course.
    const seats_selector = course.courseCode.charAt(course.courseCode.length - 1) === '1'
      ? vsbSelectors.seatsTerm
      : vsbSelectors.seatsTutLab;

    await page.waitForSelector(seats_selector);
    const matchingElements = await page.$$(seats_selector);
    const numberOfMatches = matchingElements.length;

    let found = false;
    // Search for the element with matching courseCode. Only this one has accurate 'Seats: Available/Full'.
    for (let i = 0; i < numberOfMatches; i++) {
      const text = await matchingElements[i].evaluate(el => el.textContent);

      if (text.includes(course.courseCode)) {
        // console.log(text);
        course.state = text;
        found = true;
        break;
      }
    }

    // Special case. User entered a Lab/Tutorial courseCode, but ending with '1'. So, no tutorial / lab section is specified. 
    // The VSB search bar will recognize this as a valid code, but it is NOT valid for REM.
    if (!found) {
      console.log(`${course.courseCode} - Lab/Tutorial courses should NOT end in '1', please check again.`);
      console.log("Continuing execution WITHOUT this catalogue code");
      try {
        await page.$eval(vsbSelectors.removeBox1, el => el.click());
      } catch (error) {
        await page.$eval(vsbSelectors.removeBox2, el => el.click());
      }
      return listOfCourses.filter((c) => c.courseCode !== course.courseCode);
    }

    course.reformatState();
    // console.log(`${course.courseCode} | ${course.state}`);

    await page.waitForSelector(vsbSelectors.courses);
    await page.$eval(vsbSelectors.courses, el => el.click());

    try {
      await page.$eval(vsbSelectors.removeBox1, el => el.click());
    } catch (error) {
      await page.$eval(vsbSelectors.removeBox2, el => el.click());
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return listOfCourses;
}

module.exports = {
  updateCourseStates
};