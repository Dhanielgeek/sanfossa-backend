const express = require("express");
const router = express.Router();
const { adminProtect } = require("../middleware/authAdmin");
const {
  createNewsletter,
  sendNewsletter,
} = require("../Controllers/newsletterController");

router.post("/", adminProtect, createNewsletter);
router.post("/:id/send", adminProtect, sendNewsletter);

module.exports = router;
