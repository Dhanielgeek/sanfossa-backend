const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a blog title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    // --- NEW FIELD ADDED ---
    subtitle: {
        type: String,
        required: false, // Make this optional
        trim: true,
        maxlength: [150, 'Subtitle cannot be more than 150 characters']
    },
    // -----------------------
    image: {
        type: String,
        default: 'no-photo.jpg' // Placeholder for the image URL or file path
    },
    readTimeMinutes: {
        type: Number,
        required: [true, 'Please estimate the read time in minutes'],
        min: [1, 'Read time must be at least 1 minute']
    },
    paragraphs: {
        // An Array of Strings for the main content
        type: [String], 
        required: [true, 'Blog content cannot be empty']
    },
    user: {
        // Link to the User model (the foreign key)
        type: mongoose.Schema.ObjectId, 
        ref: 'User', // Reference the 'User' model
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true 
});

module.exports = mongoose.model('Blog', BlogSchema);