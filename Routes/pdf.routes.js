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
const { protect } = require("../middleware/auth");

router.post(
  "/upload",
  protect,
  pdfUploadMiddleware.single("pdf"),
  handlePdfUploadError,
  uploadPdf,
);
router.get("/", getAllPdfs);
router.get("/:id", getSinglePdf);
router.delete("/:id", protect, deletePdf);

module.exports = router;
