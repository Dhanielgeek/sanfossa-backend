const mongoose = require("mongoose");

const reflectionNoteSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContinuityProduct",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      default: "New Reflection Note",
    },

    body: {
      type: String,
      required: true,
    },

    excerpt: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

reflectionNoteSchema.pre("save", function (next) {
  this.excerpt = this.body.slice(0, 90);
  next();
});

module.exports = mongoose.model("ReflectionNote", reflectionNoteSchema);
