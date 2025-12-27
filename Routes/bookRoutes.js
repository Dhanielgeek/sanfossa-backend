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

// Create story (with image upload)
router.post("/", adminProtect, upload.single("coverImage"), createBook);

// Get all stories (draft + published)
router.get("/admin/all", adminProtect, getAllBooksAdmin);

// Update story (optional image upload)
router.put("/:id", adminProtect, upload.single("coverImage"), updateBook);

// Delete story
router.delete("/:id", adminProtect, deleteBook);

module.exports = router;
