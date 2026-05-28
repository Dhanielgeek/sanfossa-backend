// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// exports.sendEmail = async ({ to, subject, html }) => {
//   await transporter.sendMail({
//     from: `"Your Brand" <${process.env.EMAIL_USER}>`,
//     to,
//     subject,
//     html,
//   });
// };

const { Resend } = require("resend");

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment variables");
}

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: "SankofaSeek <hello@support.sankofaseek.com>",
      to,
      subject,
      html,
    });

    return response;
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};
