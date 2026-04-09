const mongoose = require("mongoose");

const WaitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

WaitlistSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("Waitlist", WaitlistSchema);
