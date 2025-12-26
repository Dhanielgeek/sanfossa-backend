const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    author: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    excerpt: {
      type: String,
      maxlength: 300,
    },

    content: {
      type: String,
      required: true,
    },

    featuredImage: {
      type: String, // image URL or uploaded path
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "scheduled", "published"],
      default: "draft",
    },

    publishDate: {
      type: Date,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", BlogSchema);
