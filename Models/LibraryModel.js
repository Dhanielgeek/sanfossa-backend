const mongoose = require("mongoose");

const LibrarySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    paymentReference: String,

    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// prevent duplicate ownership
LibrarySchema.index({ email: 1, book: 1 }, { unique: true });

module.exports = mongoose.model("Library", LibrarySchema);
