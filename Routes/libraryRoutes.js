const express = require("express");
const router = express.Router();

const {
  getUserLibrary,
  getAllLibrary,
} = require("../Controllers/libraryController");

router.get("/all", getAllLibrary);

router.get("/:email", getUserLibrary);

module.exports = router;
