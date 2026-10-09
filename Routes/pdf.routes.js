const express = require("express");
const router = express.Router();

const {
  uploadPdf,
  getAllPdfs,
  getSinglePdf,
  deletePdf,
} = require("../Controllers/pdf.controller");
const {
  uploadPdf: pdfUploadMiddleware,
  handlePdfUploadError,
} = require("../middleware/upload.middleware");
const { adminProtect } = require("../middleware/authAdmin");

// Raw PDF URLs are admin-only; readers get content through the book
// stream endpoint, never a direct file link.
router.post(
  "/upload",
  adminProtect,
  pdfUploadMiddleware.single("pdf"),
  handlePdfUploadError,
  uploadPdf,
);
router.get("/", adminProtect, getAllPdfs);
router.get("/:id", adminProtect, getSinglePdf);
router.delete("/:id", adminProtect, deletePdf);

module.exports = router;
