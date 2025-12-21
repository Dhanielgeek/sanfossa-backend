// controllers/blogController.js (Updated)

const Blog = require("../Models/BlogModel.js");
const { notifySubscribers } = require("../utill/notificationService.js"); // Import service

exports.createBlogPost = async (req, res, next) => {
  try {
    // ... (Existing logic to process req.body, req.file, and req.user) ...
    req.body.user = req.user.id;
    // ... (Image and Paragraph handling) ...

    const blogPost = await Blog.create(req.body);

    // --- NEW: Send Notification Email ---
    notifySubscribers("BLOG", blogPost);
    // -----------------------------------

    res.status(201).json({
      success: true,
      message: "Blog post created and subscribers notified!",
      data: blogPost,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
