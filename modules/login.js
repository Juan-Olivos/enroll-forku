const UsedDuoCodeException = require("./exception");

async function isLoggedOut(page) {
  const url = await page.url();
  return url.includes("passportyork");
}

async function ppyLogin(page) {
  const currentTime = new Date();
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Toronto'
  };

  console.log(currentTime.toLocaleString('en-US', options));

  console.log("PPY: logging in...");
  await page.waitForSelector("#mli");
  await page.type('#mli', process.env.PPY_USERNAME);
  await page.type('#password', process.env.PPY_PASSWORD);

  const button = 'body > div.container.page-content > div.row > div:nth-child(1) > form > div:nth-child(2) > div.col-md-8 > p:nth-child(2) > input';
  await page.waitForSelector(button);
  await page.click(button);

  console.log("sleeping for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("done with PPY login");
}

async function duoLogin(page) {
  console.log("Signing into duo...");

  const frames = page.frames();
  const duoF = frames[1];
  if (duoF) {
    await duoF.waitForSelector('#login-form > div:nth-child(17) > div > label > input[type=checkbox]');
    await duoF.click("#login-form > div:nth-child(17) > div > label > input[type=checkbox]"); // remember 30 days
    await new Promise(resolve => setTimeout(resolve, 1000));
    await duoF.$eval('#passcode', el => el.click());
    await duoF.$eval('.passcode-input', (el, duocode) => { el.value = duocode }, process.env.DUOCODE);
    await duoF.$eval('#passcode', el => el.click());
  }

  console.log("sleeping for 20 seconds...");
  await new Promise(resolve => setTimeout(resolve, 20000));

  if (await isLoggedOut(page)) {
    throw new UsedDuoCodeException();
  }

  console.log("done with DUO login");
}

module.exports = {
  isLoggedOut,
  ppyLogin,
  duoLogin
};