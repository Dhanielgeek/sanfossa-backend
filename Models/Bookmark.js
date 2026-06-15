const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    page: Number,

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContinuityProduct",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Bookmark", bookmarkSchema);
