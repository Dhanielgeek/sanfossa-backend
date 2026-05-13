const express = require("express");
const router = express.Router();

const {
  getUserLibrary,
  getAllLibrary,
} = require("../Controllers/libraryController");

router.get("/:email", getUserLibrary);

router.get("/all", getAllLibrary);

module.exports = router;
