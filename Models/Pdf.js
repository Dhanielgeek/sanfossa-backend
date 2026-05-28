const mongoose = require("mongoose");

const PdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "PDF title is required"],
    trim: true,
    maxlength: [200, "Title cannot be more than 200 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, "Description cannot be more than 1000 characters"],
    default: "",
  },
  pdfUrl: {
    type: String,
    required: true,
    trim: true,
  },
  publicId: {
    type: String,
    required: true,
    trim: true,
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Pdf", PdfSchema);
