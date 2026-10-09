const express = require("express");
const router = express.Router();

const {
  createBook,
  updateBook,
  deleteBook,
  getAllBooksAdmin,
  getPublicBooks,
  getSingleBook,
  // incrementBookView,
  trackBookView,
} = require("../Controllers/bookController");
const {
  getBookAccess,
  streamBookMedia,
} = require("../Controllers/bookAccessController");

const upload = require("../middleware/upload");
const { protect } = require("../middleware/auth");
const { adminProtect } = require("../middleware/authAdmin");

/* =======================
   PUBLIC ROUTES
======================= */

// Get all published stories (public)
router.get("/", getPublicBooks);

// Get all stories (draft + published)
router.get("/admin/all", adminProtect, getAllBooksAdmin);

// Get single published story (metadata only, never the file URLs)
router.get("/:id", getSingleBook);

/* =======================
   READ-ONLY ACCESS
   Files are never downloadable. Entitled users get a short-lived stream
   token and the media is proxied through the API.
======================= */

// Check whether the signed-in user can read this story (free or purchased)
router.get("/:id/access", protect, getBookAccess);

// Stream PDF/audio/video bytes (auth via stream token)
router.get("/:id/stream/:kind", streamBookMedia);

/* =======================
   ADMIN ROUTES
======================= */

const bookUploads = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "pdfFile", maxCount: 1 },
  { name: "audioFile", maxCount: 1 },
  { name: "videoFile", maxCount: 1 },
  { name: "mediaUrl", maxCount: 1 },
]);

// Create story (with image + PDF upload)
router.post("/", adminProtect, bookUploads, createBook);

// Update story (optional image + PDF upload)
router.put("/:id", adminProtect, bookUploads, updateBook);

// Delete story
router.delete("/:id", adminProtect, deleteBook);

//View books
router.post("/:id/track-view", trackBookView);
router.post("/books/:id/view", trackBookView);
router.post("/books/:id/track-view", trackBookView);

module.exports = router;
