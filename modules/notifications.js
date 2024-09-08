const nodemailer = require('nodemailer');

async function sendGmailNotification(subject, body) {

  if (!process.env.EXTERNAL_GMAIL || !process.env.GMAIL_APP_PASSWORD) {
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EXTERNAL_GMAIL,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });



  const mailOptions = {
    from: process.env.EXTERNAL_GMAIL,
    to: process.env.EXTERNAL_GMAIL,
    subject: subject,
    text: body
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

module.exports = {
  sendGmailNotification
};
