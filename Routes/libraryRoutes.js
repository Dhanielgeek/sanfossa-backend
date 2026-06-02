const express = require("express");
const router = express.Router();

const {
  getMyLibrary,
  getAllLibrary,
  ensureOrderBooksInLibrary,
  getLibraryByUserId,
} = require("../Controllers/libraryController");

const { protect } = require("../middleware/auth");
const { adminProtect } = require("../middleware/authAdmin");

// 👤 current user library
router.get("/me", protect, getMyLibrary);

// 🔐 admin: all libraries
router.get("/all", adminProtect, getAllLibrary);

// 🔐 admin: specific user library
router.get("/:id", adminProtect, getLibraryByUserId);

module.exports = router;
