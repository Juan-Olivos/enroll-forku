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

async function sendSuccessfulEnrolmentGmail(enrolledCourses) {
  const courseDescriptions = enrolledCourses.map(course => course.getFullDescription()).join('\n');
  const subject = 'Course Enrollment Success';
  const body = `Successfully enrolled in ${enrolledCourses.length} course(s):\n\n${courseDescriptions}`;
  await sendGmailNotification(subject, body);
}

async function sendErrorGmail(error) {
  const subject = 'Course Enrollment Error';
  const body = `An error occurred during course enrollment: ${error}`;
  await sendGmailNotification(subject, body);
}

module.exports = {
  sendGmailNotification,
  sendSuccessfulEnrolmentGmail,
  sendErrorGmail
};
