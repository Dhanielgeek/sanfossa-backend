// models/Order.js
const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  userInfo: {
    // Guest info
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
  },
  items: [
    {
      book: {
        type: mongoose.Schema.ObjectId,
        ref: "Book",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, "Quantity must be at least 1"],
      },
      priceAtPurchase: {
        type: Number,
        required: true,
      },
    },
  ],
  //   totalAmount: {
  //     type: Number,
  //     required: true,
  //   },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },
  status: {
    type: String,
    enum: ["Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Processing",
  },
  orderedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save: calculate total
OrderSchema.pre("save", function (next) {
  this.totalAmount = this.items.reduce(
    (acc, item) => acc + item.quantity * item.priceAtPurchase,
    0,
  );
  next();
});

module.exports = mongoose.model("Order", OrderSchema);
