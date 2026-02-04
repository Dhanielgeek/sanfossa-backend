const express = require("express");
const router = express.Router();

const {
  createBook,
  updateBook,
  deleteBook,
  getAllBooksAdmin,
  getPublicBooks,
  getSingleBook,
  downloadBook,
} = require("../Controllers/bookController");

const upload = require("../middleware/upload");
const { protect } = require("../middleware/auth");
const { adminProtect } = require("../middleware/authAdmin");

/* =======================
   PUBLIC ROUTES
======================= */

// Get all published stories (public)
router.get("/", getPublicBooks);

// Get single published story
router.get("/:id", getSingleBook);

// Download story (free only)
router.get("/:id/download", protect, downloadBook);

/* =======================
   ADMIN ROUTES
======================= */

const bookUploads = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "pdfFile", maxCount: 1 }, // <-- PDF field
]);

// Create story (with image + PDF upload)
router.post("/", adminProtect, bookUploads, createBook);

// Update story (optional image + PDF upload)
router.put("/:id", adminProtect, bookUploads, updateBook);

// Get all stories (draft + published)
router.get("/admin/all", adminProtect, getAllBooksAdmin);

// Delete story
router.delete("/:id", adminProtect, deleteBook);

module.exports = router;
