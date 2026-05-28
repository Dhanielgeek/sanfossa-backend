const express = require("express");
const router = express.Router();

const {
  uploadMedia,
  getAllMedia,
  getSingleMedia,
  deleteMedia,
} = require("../Controllers/mediaController");

const { adminProtect } = require("../middleware/authAdmin");
const upload = require("../middleware/upload");

// POST /api/media/upload  — admin uploads a photo or PDF
router.post("/upload", adminProtect, upload.single("file"), uploadMedia);

// GET /api/media           — public, supports ?type=pdf|image|video|audio
router.get("/", getAllMedia);

// GET /api/media/:id       — public, returns viewUrl ready for <iframe> / new tab
router.get("/:id", getSingleMedia);

// DELETE /api/media/:id    — admin only
router.delete("/:id", adminProtect, deleteMedia);

module.exports = router;
