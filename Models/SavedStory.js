const mongoose = require("mongoose");

/**
 * A story a user bookmarked from its detail page ("Save Story").
 */
const SavedStorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
  },
  { timestamps: true },
);

SavedStorySchema.index({ user: 1, book: 1 }, { unique: true });

module.exports = mongoose.model("SavedStory", SavedStorySchema);
