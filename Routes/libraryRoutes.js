const express = require("express");
const router = express.Router();

const { getUserLibrary } = require("../controllers/LibraryController");

router.get("/:email", getUserLibrary);

module.exports = router;
