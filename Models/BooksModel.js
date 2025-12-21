const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a book title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    author: {
        type: String,
        required: [true, 'Please add the author name'],
        trim: true,
    },
    category: {
        type: String,
        enum: ['History', 'Stories', 'Fiction', 'Other'], // Your specific book categories
        required: [true, 'Please specify the category of the book']
    },
    price: {
        type: Number,
        required: [true, 'Please specify the book price'],
        min: [0.01, 'Price must be greater than zero']
    },
    stockQuantity: {
        type: Number,
        required: [true, 'Please specify the current stock quantity'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    description: {
        type: String,
        required: false,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    imageUrl: {
        type: String,
        default: 'no-book-cover.jpg' // URL or file path for the book cover image
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true 
});

module.exports = mongoose.model('Book', BookSchema);