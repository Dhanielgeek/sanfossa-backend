const fs = require("fs");
const path = require("path");
const multer = require("multer");

const TEMP_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "pdfs");
const MAX_PDF_SIZE_MB = 20;

fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const sanitizeFilename = (filename = "document.pdf") => {
  const parsed = path.parse(filename);
  const safeName = parsed.name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeName || "document"}-${Date.now()}.pdf`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const pdfFileFilter = (req, file, cb) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (mimetype === "application/pdf" && extension === ".pdf") {
    return cb(null, true);
  }

  const error = new Error("Only PDF files are allowed");
  error.statusCode = 415;
  return cb(error, false);
};

const uploadPdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: MAX_PDF_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

const handlePdfUploadError = (err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `PDF file size cannot exceed ${MAX_PDF_SIZE_MB}MB`
        : err.message;

    return res.status(400).json({
      success: false,
      message,
    });
  }

  return res.status(err.statusCode || 400).json({
    success: false,
    message: err.message || "PDF upload failed",
  });
};

module.exports = {
  uploadPdf,
  handlePdfUploadError,
  TEMP_UPLOAD_DIR,
  MAX_PDF_SIZE_MB,
};
