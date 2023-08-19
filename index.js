const puppeteer = require('puppeteer');
require('dotenv').config();

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-dev-shm-usage',
  ]
  });

  const page = await browser.newPage();

  const VSB_url = 'https://schedulebuilder.yorku.ca/vsb/criteria.jsp?access=0&lang=en&tip=1&page=results&scratch=0&term=2023102119&sort=none&filters=iiiiiiii&bbs=013IJ012NV014IV015IV016IV013NV236NV236IJ235IV232IV233IV234IV012KL&ds=5728-5844-5845-5943&cams=0_1_2_3_4_5_6&locs=any&course_0_0=LE-EECS-4415-3.00-EN-&sa_0_0=&cs_0_0=--2023070_P84Y01--&cpn_0_0=&csn_0_0=&ca_0_0=&dropdown_0_0=us_--2023070_P84Y01--&ig_0_0=0&rq_0_0=&course_1_0=AP-POLS-3070-3.00-EN-&sa_1_0=&cs_1_0=--2023087_K57F01--&cpn_1_0=&csn_1_0=&ca_1_0=&dropdown_1_0=al&ig_1_0=0&rq_1_0=&course_2_0=AP-ECON-1000-3.00-EN-&sa_2_0=&cs_2_0=--2023070_W56F01-W56F02-&cpn_2_0=F&csn_2_0=B&ca_2_0=&dropdown_2_0=al&ig_2_0=0&rq_2_0=';

  await page.goto(VSB_url);

  await page.screenshot({ path: 'test1.png' }); 

  await ppyLogin(page);
  await duoLogin(page);

  const coursesCodes = getCourseCodes(VSB_url);
  const catalogCodes = getCatalogCodes(VSB_url);

  console.log("And we are in?");
  await page.screenshot({ path: 'test5.png' });

  console.log("reloading page.");
  await page.reload();
  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  await page.screenshot({ path: 'test6.png' }); 
  console.log("done");

  await browser.close();
})();


async function ppyLogin(page) {

  console.log("PPY: logging in...");
  await page.type('#mli', process.env.PPY_USERNAME); // Username box
  await page.type('#password', process.env.PPY_PASSWORD); // Password box

  await page.screenshot({ path: 'test2.png' });
  
  const button = 'body > div.container.page-content > div.row > div:nth-child(1) > form > div:nth-child(2) > div.col-md-8 > p:nth-child(2) > input';
  await page.waitForSelector(button);
  await page.click(button);

  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("done with PPY login");
}

async function duoLogin(page) {
  console.log("Signing into duo...");
  await page.screenshot({ path: 'test3.png' });

  const frames = page.frames();
  const duoF = frames[1];
  if (duoF) {
      await duoF.$eval('#passcode', el => el.click());
      await duoF.$eval('.passcode-input', (el, duocode) => { el.value = duocode }, process.env.DUOCODE);
      await duoF.$eval('#passcode', el => el.click());
  }

  await page.screenshot({ path: 'test4.png' });

  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("done with DUO login");
}

function getCourseCodes(url) {
  const parameters = url.split('&');

  const courseParams = parameters.filter(param => param.startsWith('course_'));

  const courseCodes = courseParams.map(item => item.substring(item.indexOf('=')+1));

  return courseCodes;
}

function getCatalogCodes(url) {
  const parameters = url.split('&');

  const catalogParams = parameters.filter(param => param.startsWith('cs_'));

  const catalogCodes = catalogParams.map(item => {
    const parts = item.split('_');
    const catalogueCode = parts.slice(3).join('_').substring(0,6);;
    return catalogueCode;
  });

  return catalogCodes;
}