const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); // Middleware for token verification
const User = require('../models/User'); // Import User Model for profile update logic

// Assuming you have these functions defined in controllers/authController.js
const { 
    register, 
    login, 
    forgotPassword, 
    resetPassword 
} = require('../Controllers/authController'); 

// ------------------------------------
// 1. AUTHENTICATION (PUBLIC ACCESS)
// ------------------------------------

// @route   POST /api/v1/auth/register
// @desc    Register/Sign Up a new user
// @access  Public
router.post('/register', register); 

// @route   POST /api/v1/auth/login
// @desc    Log in a user & get a JWT token
// @access  Public
router.post('/login', login);

// @route   POST /api/v1/auth/forgotpassword
// @desc    Send password reset link/token to user email
// @access  Public
router.post('/forgotpassword', forgotPassword);

// @route   PUT /api/v1/auth/resetpassword/:token
// @desc    Reset password using the token sent to email
// @access  Public
router.put('/resetpassword/:token', resetPassword);


// ------------------------------------
// 2. USER PROFILE MANAGEMENT (PROTECTED)
// ------------------------------------

// @route   GET /api/v1/auth/me
// @desc    Get current logged-in user details (Read Profile)
// @access  Private (Requires a valid JWT)
router.get('/me', protect, async (req, res) => {
    // req.user is set by the 'protect' middleware
    try {
        const user = await User.findById(req.user.id).select('-password'); // Exclude password hash
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error retrieving profile' });
    }
});

// @route   PUT /api/v1/auth/updateprofile
// @desc    Update user's name or email (Edit Profile)
// @access  Private (Requires a valid JWT)
router.put('/updateprofile', protect, async (req, res) => {
    // Allows updating only non-sensitive fields
    const fieldsToUpdate = {
        name: req.body.name,
        email: req.body.email
    };

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id, 
            fieldsToUpdate, 
            { new: true, runValidators: true } // Return new document & validate
        ).select('-password');

        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: user 
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;