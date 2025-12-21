const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    // If a user is logged in, their ID is stored here. Otherwise, it is null.
    user: {
        type: mongoose.Schema.ObjectId, 
        ref: 'User', 
        required: false, // NOT required for anonymous submissions
        default: null
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        // Basic validation for email format
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    message: {
        type: String,
        required: [true, 'Message content is required'],
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    isRegistered: {
        type: Boolean,
        default: false // Tracks if the submission came from a logged-in user
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Contact', ContactSchema);
