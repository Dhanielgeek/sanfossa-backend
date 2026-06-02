const express = require("express");
const router = express.Router();

const {
  getMyLibrary,
  getAllLibrary,
  ensureOrderBooksInLibrary,
  getLibraryByUserId,
} = require("../Controllers/libraryController");

const { protect, authorize } = require("../middleware/auth");

// 👤 current user library
router.get("/me", protect, getMyLibrary);

// 🔐 admin: all libraries
router.get("/all", protect, authorize("admin"), getAllLibrary);

// 🔐 admin: specific user library
router.get("/:id", protect, authorize("admin"), getLibraryByUserId);

module.exports = router;
