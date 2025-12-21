const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    user: {
        // Link to the User who placed the order
        type: mongoose.Schema.ObjectId, 
        ref: 'User', 
        required: true
    },
    items: [{
        book: {
            // Link to the specific Book model
            type: mongoose.Schema.ObjectId,
            ref: 'Book',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1']
        },
        priceAtPurchase: {
             // Store the price at the time of purchase to maintain history
             type: Number,
             required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        type: String,
        required: [true, 'Please provide a shipping address']
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    status: {
        type: String,
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Processing'
    },
    orderedAt: {
        type: Date,
        default: Date.now
    }
});

// A pre-save hook to calculate the total amount before saving the order
OrderSchema.pre('save', function(next) {
    this.totalAmount = this.items.reduce((acc, item) => acc + item.quantity * item.priceAtPurchase, 0);
    next();
});

module.exports = mongoose.model('Order', OrderSchema);