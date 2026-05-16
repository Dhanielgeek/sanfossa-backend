const mongoose = require("mongoose");

const BookSnapshotSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    title: String,
    subtitle: String,
    summary: String,
    content: String,

    author: String,
    narrator: String,

    category: String,

    coverImage: String,
    pdfFile: String,

    readingTime: mongoose.Schema.Types.Mixed,
    ageRating: String,

    price: Number,

    tags: [String],
  },
  { _id: false },
);

const LibraryBookSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    paymentReference: {
      type: String,
      required: true,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    bookSnapshot: {
      type: BookSnapshotSchema,
      required: true,
    },
  },
  { _id: false },
);

const LibrarySchema = new mongoose.Schema(
  {
    schemaVersion: {
      type: Number,
      default: 2,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    books: {
      type: [LibraryBookSchema],
      default: [],
    },

    // Legacy row-style fields kept so existing library documents can still be
    // read while new purchases use the books[] structure above.
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

LibrarySchema.index(
  { email: 1, schemaVersion: 1 },
  {
    unique: true,
    partialFilterExpression: { schemaVersion: 2 },
  },
);
LibrarySchema.index({ email: 1, "books.bookId": 1 });
LibrarySchema.index({ "books.paymentReference": 1 });

module.exports = mongoose.model("Library", LibrarySchema);
