// utils/sendEmail.js

const nodemailer = require('nodemailer');

// Set up the transporter (using a service like Gmail, SendGrid, or a custom SMTP)
// NOTE: Store credentials in your .env file for security!
const transporter = nodemailer.createTransport({
    // Example using GMail (requires "App Password" to be set up in Google Security)
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
    auth: {
        user: process.env.EMAIL_USERNAME, // Your email address
        pass: process.env.EMAIL_PASSWORD  // Your app password
    },
    // For services other than Gmail, you might use:
    // host: process.env.EMAIL_HOST, 
    // port: process.env.EMAIL_PORT,
    // secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
});

/**
 * Reusable function to send a single email.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} html - HTML content for the email body.
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_USERNAME}>`,
            to: to,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email failed to send:', error);
        return false;
    }
};

module.exports = sendEmail;