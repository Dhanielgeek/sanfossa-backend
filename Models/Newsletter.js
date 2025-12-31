const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    content: {
      type: String, // HTML content
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "sent"],
      default: "draft",
    },
    sentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Newsletter", newsletterSchema);
