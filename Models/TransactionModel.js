const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    gateway: {
      type: String,
      default: "Paystack",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    authorization_url: String,

    gatewayResponse: Object,

    paidAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", TransactionSchema);
