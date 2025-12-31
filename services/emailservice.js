const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"Your Brand" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
