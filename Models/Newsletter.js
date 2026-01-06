// Models/Newsletter.js (excerpt)
const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    content: { type: String, required: true }, // HTML content
    status: {
      type: String,
      enum: ["draft", "sent", "partial", "dry-sent"],
      default: "draft",
    },
    sentAt: { type: Date },
    metrics: {
      totalRecipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      dryRun: { type: Boolean, default: false },
      lastAttemptAt: { type: Date },
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Newsletter", NewsletterSchema);
