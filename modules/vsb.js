const { ppyLogin, duoLogin, ensureLoggedIn, loginWithDUO } = require("./login");
const { sendGmailNotification, sendSuccessfulEnrolmentGmail, sendErrorGmail} = require("./notifications");
const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const { SystemLoadingError } = require("./exception");

const TERM = "2024115117"; // Summer 2025
const BASE_URL_ADD = "https://schedulebuilder.yorku.ca/vsb/add_suggest.jsp?cams=0_1_2_3_4_5_6";
const BASE_URL_GET_CLASS = "https://schedulebuilder.yorku.ca/vsb/getclassdata.jsp?nouser=1";

function generateAddCourseUrl(course, unixTime) {
  return `${BASE_URL_ADD}&_=${unixTime}&course_add=${course.catalogCode}-&term=${TERM}&`;
}

function generateGetClassDataUrl(listOfCourses) {
  let url = `${BASE_URL_GET_CLASS}&term=${TERM}&`;
  listOfCourses.forEach((course, index) => {
    url += `course_${index}_0=${course.catalogCode}-&`;
  });
  return url + nWindow() + "&_=" + Date.now();
}

async function addNameToCourses(page, listOfCourses) {
  for (const course of listOfCourses) {
    const unixTime = Date.now();
    const url = generateAddCourseUrl(course, unixTime);
    
    await page.goto(url, { waitUntil: 'networkidle0' });

    // First time login needs DUO authentication
    await loginWithDUO(page);
    
    await page.waitForSelector('.pretty-print', { timeout: 90000 });
    
    // Extract the XML text
    const xmlText = await page.evaluate(() => {
      const pre = document.querySelector('.pretty-print');
      return pre ? pre.textContent : null;
    });

    if (xmlText) {
      if (xmlText.includes("System Loading")) {
        throw new SystemLoadingError("Possible system maintenance detected.");
      }
    
      const courseName = parseXMLForCourseName(xmlText, course.catalogCode);
      if (courseName) {
        course.name = courseName;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 seconds
  }
}

function parseXMLForCourseName(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  const rsElement = xmlDoc.getElementsByTagName('rs')[0];

  return rsElement.textContent.trim();
  
}

var _0xf8b0=["\x67\x65\x74\x54\x69\x6D\x65","\x66\x6C\x6F\x6F\x72","\x26\x74\x3D","\x26\x65\x3D"];function nWindow(){var _0x9501x2=( new Date())[_0xf8b0[0]]();_0x9501x2=Math[_0xf8b0[1]]((_0x9501x2/60000))%1000;e=_0x9501x2%3+_0x9501x2%19+_0x9501x2%42;return _0xf8b0[2]+_0x9501x2+_0xf8b0[3]+e;}

async function updateCourseStates(page, listOfCourses) {
  const url = generateGetClassDataUrl(listOfCourses);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await ensureLoggedIn(page);

  await page.waitForSelector('.pretty-print');
  
  const xmlText = await page.evaluate(() => {
    const pre = document.querySelector('.pretty-print');
    return pre ? pre.textContent : null;
  });

  const changedCourses = [];

  if (xmlText) {
    for (const course of listOfCourses) {
      const openSeats = parseXMLForOpenSeats(xmlText, course.catalogCode);
      
      if (openSeats <= 0) {
        course.state = "Full";
        // console.log(`Course ${course.name} is full with ${openSeats} seats.`);
      } else {
        if (course.state === "Full") {
          changedCourses.push({
            name: course.name,
            catalogCode: course.catalogCode,
            seats: openSeats
          });
        }
        course.state = "Available";
        console.log(`Course ${course.name} is available with ${openSeats} seats.`);
      }
    }

    if (changedCourses.length > 0) {
      const subject = "Course Availability Update";
      const body = changedCourses.map(c => 
        `${c.name} (${c.catalogCode}) is now available with ${c.seats} seats.`
      ).join('\n') + '\n\nAttempting to enroll.';
      

      sendGmailNotification(subject, body).catch(err => {
        console.error("Failed to send email:", err);
      });
      
    }
  }

  return listOfCourses;
}


function parseXMLForOpenSeats(xmlText, targetKey) {
  const parser = createSilentDomParser();
  
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  // Use XPath to find the block element with the specified key
  const xpathSelector = `//block[@key="${targetKey}"]`;
  const nodes = xpath.select(xpathSelector, xmlDoc);
  
  if (nodes.length > 0) {
    // If found, return the 'os' attribute value    
    return parseInt(nodes[0].getAttribute('os'), 10);
  } else {
    console.log(`Block with key '${targetKey}' not found`);
    return null;
  }
}

function createSilentDomParser() {
  return new DOMParser({
    errorHandler: {
      warning: function() {},
      error: function() {},
      fatalError: function(e) { console.error(e) }
    }
  });
}


module.exports = {
  updateCourseStates,
  addNameToCourses
};