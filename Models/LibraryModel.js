const mongoose = require("mongoose");

const LibrarySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    paymentReference: {
      type: String,
    },

    purchasedAt: {
      type: Date,
      default: Date.now,
    },

    // FULL BOOK SNAPSHOT
    bookSnapshot: {
      bookId: mongoose.Schema.Types.ObjectId,

      title: String,
      subtitle: String,
      summary: String,
      content: String,

      author: String,
      narrator: String,

      category: String,

      coverImage: String,
      pdfFile: String,

      readingTime: Number,
      ageRating: String,

      price: Number,

      tags: [String],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Library", LibrarySchema);
