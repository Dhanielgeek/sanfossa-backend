const mongoose = require("mongoose");

const readingProgressSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContinuityProduct",
      required: true,
    },

    currentPage: {
      type: Number,
      default: 0,
    },

    totalPages: {
      type: Number,
      default: 0,
    },

    percentage: {
      type: Number,
      default: 0,
    },

    lastOpenedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReadingProgress", readingProgressSchema);
