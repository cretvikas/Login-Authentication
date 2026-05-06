// utils/sendEmail.js
// Sends emails using nodemailer + Gmail SMTP.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Gmail App Password
  },
});

/**
 * Send an email.
 * @param {{ to: string, subject: string, text?: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  await transporter.sendMail({
    from: `"Authenticator" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = sendEmail;
