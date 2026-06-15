const mongoose = require("mongoose");

const continuityProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    coverImage: String,

    totalPages: {
      type: Number,
      default: 0,
    },

    currentPage: {
      type: Number,
      default: 0,
    },

    pathway: {
      type: String,
    },

    progress: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ContinuityProduct", continuityProductSchema);
