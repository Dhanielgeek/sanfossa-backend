const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required for subscription"],
    unique: true, // Prevents duplicate emails
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please enter a valid email address",
    ],
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Prevent model overwrite on hot reload
module.exports =
  mongoose.models.Newsletter || mongoose.model("Newsletter", NewsletterSchema);
