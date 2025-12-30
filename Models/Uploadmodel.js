const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", uploadSchema);
