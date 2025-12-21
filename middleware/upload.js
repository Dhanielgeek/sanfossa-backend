// middleware/upload.js

const multer = require('multer');
const path = require('path');

// --- 1. Storage Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Files will be stored in a folder named 'uploads/blogs'
        cb(null, 'uploads/blogs/'); 
    },
    filename: (req, file, cb) => {
        // Create a unique name: fieldname-timestamp.ext
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// --- 2. File Filter (Security & Validation) ---
const fileFilter = (req, file, cb) => {
    // Check for common image MIME types
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// --- 3. Multer Export for Blog Posts ---
const blogUpload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5 Megabytes limit
    },
    fileFilter: fileFilter
});

// Export the ready-to-use middleware
module.exports = blogUpload;
