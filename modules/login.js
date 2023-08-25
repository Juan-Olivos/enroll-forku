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

  console.log("done with PPY login");
}

async function duoLogin(page) {
  console.log("Signing into duo...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  const frames = page.frames();
  console.log(frames);
  const duoF = frames[1];

  await duoF.waitForSelector('#login-form > div:nth-child(17) > div > label > input[type=checkbox]');
  await duoF.click("#login-form > div:nth-child(17) > div > label > input[type=checkbox]"); // remember 30 days

  // await useDuoCode(page, duoF);
  await sendPush(duoF);

  console.log("done with DUO login");
}

async function useDuoCode(page, duoF) {
  await duoF.$eval('#passcode', el => el.click());
  await duoF.$eval('.passcode-input', (el, duocode) => { el.value = duocode }, process.env.DUOCODE);
  await duoF.$eval('#passcode', el => el.click());

  console.log("sleeping for 20 seconds...");
  await new Promise(resolve => setTimeout(resolve, 20000));

  if (await isLoggedOut(page)) {
    throw new UsedDuoCodeException();
  }
}

async function sendPush(duoF) {
  await duoF.$eval(`#auth_methods > fieldset > div.row-label.push-label > button`, el => el.click());

  console.log("sleeping for 30 seconds...");
  await new Promise(resolve => setTimeout(resolve, 30000));
}

module.exports = {
  isLoggedOut,
  ppyLogin,
  duoLogin
};