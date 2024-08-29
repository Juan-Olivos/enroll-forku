const nodemailer = require('nodemailer');

async function sendGmailNotification(enrolledCourses) {

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

  const courseDescriptions = enrolledCourses.map(course => course.getFullDescription()).join('\n');

  const mailOptions = {
    from: process.env.EXTERNAL_GMAIL,
    to: process.env.EXTERNAL_GMAIL,
    subject: 'Course Enrollment Success',
    text: `Successfully enrolled in ${enrolledCourses.length} course(s):\n\n${courseDescriptions}`
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
