const Contact = require("../Models/contactModel");
const User = require("../Models/userModel"); // Needed to fetch user details if logged in
// NOTE: You would typically integrate nodemailer here to send an email notification

// @desc    Handle contact form submission
// @route   POST /api/v1/contact
// @access  Public (Optional use of protect middleware)
exports.submitContactForm = async (req, res, next) => {
  let submissionData = { ...req.body };

  try {
    // --- 1. Check if user is logged in (ID is available on req.user) ---
    if (req.user && req.user.id) {
      submissionData.user = req.user.id;
      submissionData.isRegistered = true;

      // OPTIONAL: If front end didn't send name/email, fetch it from DB
      // This is good if you want to ensure the DB-stored name/email is used.
      const user = await User.findById(req.user.id).select("name email");
      if (user) {
        // Use logged-in user's data to override form input (if needed)
        submissionData.fullName = user.name;
        submissionData.email = user.email;
      }
    }

    // --- 2. Input Validation Check (Ensure required fields are present) ---
    if (
      !submissionData.fullName ||
      !submissionData.email ||
      !submissionData.message
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide full name, email, and message.",
      });
    }

    // --- 3. Save the Contact Message to the database ---
    const contactMessage = await Contact.create(submissionData);

    // --- 4. Send Email Notification (Placeholder) ---
    // await sendContactNotificationEmail(contactMessage);

    res.status(201).json({
      success: true,
      message: "Your message has been successfully submitted!",
      data: contactMessage,
    });
  } catch (error) {
    // Handle Mongoose validation errors or other server errors
    res.status(500).json({ success: false, error: error.message });
  }
};
