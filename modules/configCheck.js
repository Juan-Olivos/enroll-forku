const chalk = require('chalk');

function checkEnvVariables() {
  console.log(chalk.underline('Configuration Status:'));

  // Check York University credentials
  if (process.env.PPY_USERNAME && process.env.PPY_PASSWORD) {
    console.log(chalk.green('✓ York University credentials are set.'));
  } else {
    console.log(chalk.red('✗ York University credentials are missing. Please set PPY_USERNAME and PPY_PASSWORD in your .env file.'));
    process.exit(1);
  }

  // Check email notification status and validate values
  if (process.env.EXTERNAL_GMAIL && process.env.GMAIL_APP_PASSWORD) {
    
    // Remove spaces from GMAIL_APP_PASSWORD
    process.env.GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '');

    if (!(process.env.EXTERNAL_GMAIL.includes('@gmail.com') || process.env.EXTERNAL_GMAIL.includes('@googlemail.com'))) {
      console.log(chalk.red('✗ Invalid email address. Please set a valid gmail address in EXTERNAL_GMAIL in your .env file.'));
    } else if (process.env.GMAIL_APP_PASSWORD.length !== 16) {
      console.log(chalk.red('✗ Invalid Gmail App Password. Please set a valid app password in GMAIL_APP_PASSWORD in your .env file.'));
    } else {
      console.log(chalk.green('✓ Email notifications are enabled.'));
    }
  } else {
    console.log(chalk.yellow('ℹ Email notifications are not configured. You will not receive email updates.'));
    console.log(chalk.yellow('  To enable, set EXTERNAL_GMAIL and GMAIL_APP_PASSWORD in your .env file.'));
  }

  console.log();
}

module.exports = { checkEnvVariables };
