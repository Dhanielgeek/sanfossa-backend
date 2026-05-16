const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    userInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentReference: {
      type: String,
      index: true,
      sparse: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    status: {
      type: String,
      enum: ["Processing", "Completed", "Cancelled"],
      default: "Processing",
    },

    paidAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);
