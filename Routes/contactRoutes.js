const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../Controllers/contactController');
const { protect } = require('../middleware/auth'); 

// --- Custom Middleware for Optional Protection ---
// This is a common pattern to check for a token without blocking public access.
const optionalProtect = (req, res, next) => {
    // If there's an Authorization header, run the protection logic
    if (req.headers.authorization) {
        // If protect fails (invalid token), it will send a 401 error.
        // If successful, it attaches req.user.
        protect(req, res, next);
    } else {
        // No header, no user, continue as anonymous
        req.user = {}; // Initialize to an empty object
        next();
    }
};

// @route   POST /api/v1/contact
// @desc    Submit a contact form (Public access, optional user ID capture)
// @access  Public
router.post('/', optionalProtect, submitContactForm);

module.exports = router;