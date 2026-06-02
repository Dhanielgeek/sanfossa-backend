const express = require("express");
const router = express.Router();

const {
  getMyLibrary,
  getAllLibrary,
} = require("../Controllers/libraryController");

const { protect } = require("../middleware/auth");

router.get("/all", getAllLibrary);

router.get("/my-library", protect, getMyLibrary);

module.exports = router;
