const Newsletter = require('../Models/Newsletter');

// @desc    Handle new newsletter subscription
// @route   POST /api/v1/newsletter
// @access  Public
exports.subscribe = async (req, res, next) => {
    const { email } = req.body;

    // Basic validation check
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    try {
        // --- 1. Check if email is already subscribed ---
        const existingSubscriber = await Newsletter.findOne({ email });

        if (existingSubscriber) {
            // It's often best practice to return a success message even if they were 
            // already subscribed, to avoid revealing information to potential attackers.
            return res.status(200).json({ 
                success: true, 
                message: 'You are already subscribed to the newsletter.' 
            });
        }
        
        // --- 2. Create the new subscription ---
        const newSubscriber = await Newsletter.create({ email });

        // NOTE: You could optionally send a confirmation/welcome email here using Nodemailer.

        res.status(201).json({ 
            success: true, 
            message: 'Successfully subscribed to the newsletter!',
            data: newSubscriber
        });

    } catch (error) {
        // Handle Mongoose errors (e.g., if a validation error occurs despite the check)
        res.status(500).json({ success: false, error: 'Server error: Could not process subscription.' });
    }
};

// @desc    Get all newsletter subscribers (Admin view)
// @route   GET /api/v1/newsletter
// @access  Private (Admin Only)
exports.getSubscribers = async (req, res, next) => {
    try {
        const subscribers = await Newsletter.find();
        res.status(200).json({ 
            success: true, 
            count: subscribers.length, 
            data: subscribers 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
};