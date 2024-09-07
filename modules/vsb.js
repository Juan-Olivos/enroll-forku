const { isLoggedOut, ppyLogin } = require("./login");
const xpath = require('xpath');
const { DOMParser } = require('xmldom');

async function addNameToCourses(page, listOfCourses) {
  const term = "2024102119";
  const baseUrl = "https://schedulebuilder.yorku.ca/vsb/add_suggest.jsp?cams=0_1_2_3_4_5_6";
  
  for (const course of listOfCourses) {
    const unixTime = Date.now();
    const url = `${baseUrl}&_=${unixTime}&course_add=${course.catalogCode}-&term=${term}&`;
    
    await page.goto(url, { waitUntil: 'networkidle0' });
    if (await isLoggedOut(page)) {
      console.log("logging you back in...");
      await ppyLogin(page);
    }
    
    // Wait for the XML data to be loaded
    await page.waitForSelector('.pretty-print');
    
    // Extract the XML text
    const xmlText = await page.evaluate(() => {
      const pre = document.querySelector('.pretty-print');
      return pre ? pre.textContent : null;
    });
    if (xmlText === "System Loading. Try again in 0-3 minutes.") {
      console.log("Wait 30 minutes due to scheduled maintenance on the server.");
      await new Promise((resolve) => setTimeout(resolve, 1800000)); // 30 minutes
      addNameToCourses(page, [course]);
      continue;
    }

    if (xmlText) {
      // Parse the XML to find the course name
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
  const term = "2024102119";
  const baseUrl = "https://schedulebuilder.yorku.ca/vsb/getclassdata.jsp?nouser=1";
  var url = `${baseUrl}&term=${term}&`;
  for (let i = 0; i < listOfCourses.length; i++) {
    url += `course_${i}_0=${listOfCourses[i].catalogCode}-&`;
  }
  url += nWindow() + "&_=" + Date.now();
  await page.goto(url, { waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 50000)); // 50 seconds
  if (await isLoggedOut(page)) {
    console.log("logging you back in...");
    await ppyLogin(page);
  }
  await page.waitForSelector('.pretty-print');
  // Extract the XML text
  const xmlText = await page.evaluate(() => {
    const pre = document.querySelector('.pretty-print');
    return pre ? pre.textContent : null;
  });
  
  // TODO: Check if this url also give message like this.
  if (xmlText === "System Loading. Try again in 0-3 minutes.") {
    console.log("Wait 30 minutes due to scheduled maintenance on the server.");
    await new Promise((resolve) => setTimeout(resolve, 1800000)); // 30 minutes
    return await updateCourseStates(page, listOfCourses); // Recursive call
  }

  if (xmlText) {
    for (const course of listOfCourses) {
      // Parse the XML to find the course name
      const openSeats = parseXMLForOpenSeats(xmlText, course.catalogCode);
      
      if (openSeats === 0 || openSeats === -1) {
        course.state = "Full";
        console.log(`Course ${course.name} is full.`);   
      } else {
        course.state = "Available";
        console.log(`Course ${course.name} is available with ${openSeats} seats.`);
      }
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
    console.log(`Number of blocks found with same key(${targetKey}) : ${nodes.length}`);
    
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