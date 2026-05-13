const express = require("express");
const router = express.Router();

const { getUserLibrary } = require("../Controllers/libraryController");

router.get("/:email", getUserLibrary);

module.exports = router;
