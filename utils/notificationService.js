// utils/notificationService.js

const Newsletter = require("../Models/Newsletter");
const sendEmail = require("./sendEmail");

/**
 * Sends a notification email to all newsletter subscribers.
 * @param {string} type - 'BLOG' or 'BOOK'.
 * @param {object} item - The created Blog or Book document.
 */
exports.notifySubscribers = async (type, item) => {
  try {
    // 1. Fetch all subscriber emails
    const subscribers = await Newsletter.find().select("email");
    const subscriberEmails = subscribers.map((sub) => sub.email);

    if (subscriberEmails.length === 0) {
      console.log("No subscribers to notify.");
      return;
    }

    // 2. Define email content based on type
    let subject = "";
    let htmlBody = "";
    const itemUrl = `${process.env.CLIENT_URL}/${type.toLowerCase()}/${
      item._id
    }`;
    const itemImage =
      item.image ||
      item.imageUrl ||
      "https://default-image-url.com/placeholder.jpg";

    if (type === "BLOG") {
      subject = `NEW Blog Post: ${item.title}`;
      htmlBody = `
                <h2>Fresh Content Alert!</h2>
                <p>We just published a new blog post titled: <strong>${item.title}</strong>.</p>
                <img src="${itemImage}" alt="Blog Image" style="max-width: 100%; height: auto;">
                <p>Read time: ${item.readTimeMinutes} minutes.</p>
                <p>Check it out now: <a href="${itemUrl}">Read the Full Post</a></p>
            `;
    } else if (type === "BOOK") {
      subject = `NEW Book Available: ${item.title}`;
      htmlBody = `
                <h2>New Arrival in the Bookstore!</h2>
                <p>We've added a new book to our inventory: <strong>${
                  item.title
                }</strong> by ${item.author}.</p>
                <img src="${itemImage}" alt="Book Cover" style="max-width: 100%; height: auto;">
                <p>Price: $${item.price.toFixed(2)}</p>
                <p>Grab your copy: <a href="${itemUrl}">View the Book</a></p>
            `;
    } else {
      return console.error("Invalid notification type.");
    }

    // 3. Send email to all subscribers (using Promise.all for parallel sending)
    const sendPromises = subscriberEmails.map((email) =>
      sendEmail({ to: email, subject: subject, html: htmlBody })
    );

    await Promise.all(sendPromises);
    console.log(
      `Successfully notified ${subscriberEmails.length} subscribers.`
    );
  } catch (error) {
    console.error("Error notifying subscribers:", error);
  }
};
