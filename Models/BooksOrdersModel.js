const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    userInfo: {
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
          min: 1,
        },
        priceAtPurchase: {
          type: Number,
          required: true,
        },
      },
    ],

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    status: {
      type: String,
      enum: ["Processing", "Delivered", "Cancelled"],
      default: "Processing",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);
