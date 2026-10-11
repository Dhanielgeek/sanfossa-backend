const express = require("express");
const router = express.Router();

const {
  getSavedStories,
  saveStory,
  removeSavedStory,
} = require("../Controllers/savedStoryController");
const { protect } = require("../middleware/auth");

// A signed-in user's bookmarked stories ("Save Story").
router.use(protect);

router.get("/", getSavedStories);
router.post("/:bookId", saveStory);
router.delete("/:bookId", removeSavedStory);

module.exports = router;
