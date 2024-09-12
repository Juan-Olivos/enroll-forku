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

  console.log("Done with PPY login.");
}

async function ensureLoggedIn(page) {
  if (await isLoggedOut(page)) {
    await ppyLogin(page);
  }
}

async function loginWithDUO(page) {
  if (await isLoggedOut(page)) {
    await ppyLogin(page);
    await duoLogin(page);
  }
}

async function duoLogin(page) {
  console.log("Signing into duo. You have 90 seconds to authenticate.");
  await page.waitForSelector('#trust-browser-button', { timeout: 90000 });
  console.log("Successfully authenticated.");
  await page.click('#trust-browser-button');
  console.log("Done with DUO login");
}

module.exports = {
  ensureLoggedIn,
  ppyLogin,
  duoLogin,
  loginWithDUO
};