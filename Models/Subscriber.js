// Models/Subscriber.js
const mongoose = require("mongoose");

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      // optional for double opt-in
      type: Boolean,
      default: false,
    },
    verificationToken: {
      // optional for double opt-in
      type: String,
      index: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

SubscriberSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("Subscriber", SubscriberSchema);
