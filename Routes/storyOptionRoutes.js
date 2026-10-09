const express = require("express");
const router = express.Router();

const {
  getStoryOptions,
  addStoryOption,
  removeStoryOption,
} = require("../Controllers/storyOptionController");
const { adminProtect } = require("../middleware/authAdmin");

// Choices for the admin story form's select fields. Admin only.
router.use(adminProtect);

router.get("/", getStoryOptions);
router.post("/:field", addStoryOption);
router.delete("/:field", removeStoryOption);

module.exports = router;
