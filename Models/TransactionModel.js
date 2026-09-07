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
      enum: ["Paystack", "BlockBee"],
      default: "Paystack",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Cancelled"],
      default: "Pending",
    },

    authorization_url: String,

    gatewayResponse: Object,

    // --- Crypto (BlockBee) specific fields ---
    cryptoCoin: String,
    cryptoAddress: String,
    cryptoCallbackToken: {
      type: String,
      index: true,
      sparse: true,
    },
    expectedFiatAmount: Number,
    expectedFiatCurrency: String,
    expectedCoinAmount: Number,
    confirmedTxHash: String,
    confirmations: Number,

    paidAt: Date,
    emailEvents: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

TransactionSchema.index({ order: 1 });
TransactionSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
