const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    subtitle: String,

    author: {
      type: String,
      required: true,
    },
    narrator: String,

    summary: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    tags: [String],

    historicalPeriod: String,
    location: String,
    readingTime: String,
    ageRating: String,

    coverImage: String,
    images: [String],
    audioUrl: String,
    videoUrl: String,

    price: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "review", "published"],
      default: "draft",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", BookSchema);
