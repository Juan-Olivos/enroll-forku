const { isLoggedOut, ppyLogin } = require("./login");

const vsbSelectors = {
  courses: ".accessible.ak_c.nav_link.link_criteria.title_font",
  result: ".accessible.ak_r.nav_link.link_results.title_font",
  searchbar: '#code_number',
  addCourseButton: '#addCourseButton',
  seatsTerm: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(1) > td:nth-child(2)`,
  seatsTutLab: `#legend_box > div.course_box.be0 > div > div > div > label > div > div.selection_table > table > tbody > tr:nth-child(3) > td:nth-child(1)`,
  removeBox1: `#requirements > div:nth-child(3) > div.courseDiv.bc1.bd1 > div:nth-child(5) > a`,
  removeBox2: `#requirements > div:nth-child(3) > div.courseDiv.bc2.bd2 > div:nth-child(5) > a`
};

/* Visits VSB to map each Course with either 'Full' or 'Available' */
async function updateCourseStates(page, listOfCourses) {

  // Surround function by try because we may be logged out during execution of this function causing things to break.
  try {
    for (let i = 0; i < listOfCourses.length; i++) {
      const course = listOfCourses[i];

      await page.waitForSelector(vsbSelectors.courses, { timeout: 90000 });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.$eval(vsbSelectors.courses, el => el.click());

      await page.waitForSelector(vsbSelectors.searchbar);
      await page.$eval(vsbSelectors.searchbar, el => el.value = '');
      await page.type(vsbSelectors.searchbar, course.catalogCode);

      await page.waitForSelector(vsbSelectors.addCourseButton);
      await page.$eval(vsbSelectors.addCourseButton, el => el.click());

      // If a catalogCode ends with 1, it is a non-lab/tutorial course.
      const seats_selector = course.catalogCode.charAt(course.catalogCode.length - 1) === '1'
        ? vsbSelectors.seatsTerm
        : vsbSelectors.seatsTutLab;

      await page.waitForSelector(seats_selector);

      const matchingElements = await page.$$(seats_selector);
      const numberOfMatches = matchingElements.length;

      // Search for the element with matching catalogCode. Only this one has accurate 'Seats: Available/Full'.
      for (let i = 0; i < numberOfMatches; i++) {
        const text = await matchingElements[i].evaluate(el => el.textContent);

        if (text.includes(course.catalogCode)) {
          // console.log(text);
          course.state = text;
          break;
        }
      }

      course.reformatState();
      // console.log(`${course.catalogCode} | ${course.state}`);

      await page.waitForSelector(vsbSelectors.courses);
      await page.$eval(vsbSelectors.courses, el => el.click());

      try {
        await page.$eval(vsbSelectors.removeBox1, el => el.click());
      } catch (error) {
        await page.$eval(vsbSelectors.removeBox2, el => el.click());
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (err) {

    if (await isLoggedOut(page)) {
      console.log("logging you back in...");
      await ppyLogin(page);
    } else {
      console.log(error);
      console.log("If it is 12am, then the error due is to scheduled VSB maintenance, please try again later.");
    }
  } finally {
    return listOfCourses;
  }
}

module.exports = {
  updateCourseStates
};