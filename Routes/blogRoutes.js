const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth'); // Auth middleware
const blogUpload = require('../middleware/upload'); // Multer middleware
const { createBlogPost } = require('../Controllers/blogController');

// --- POST/CREATE BLOG POST ROUTE ---

// @route   POST /api/v1/blogs
// @desc    Create a new blog post (Requires image upload)
// @access  Private (Admin/Editor Only)
router.post(
    '/', 
    protect, 
    authorize('admin', 'editor'), 
    blogUpload.single('blogImage'), // 1. Handle the file upload (field name must be 'blogImage')
    createBlogPost // 2. Handle the database logic
);

// --- NOTE: You would add GET, PUT, DELETE routes here for CRUD operations ---

module.exports = router;