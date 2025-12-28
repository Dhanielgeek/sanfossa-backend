const express = require("express");
const router = express.Router();

const {
  createUpload,
  getAllUploads,
  deleteUpload,
} = require("../Controllers/uploadController");

const { adminProtect } = require("../middleware/authAdmin");
const upload = require("../middleware/upload");

/**
 * ADMIN: Create upload (2–3 images)
 */
router.post("/", adminProtect, upload.array("images", 3), createUpload);

/**
 * PUBLIC: Get all uploads (users + guests)
 */
router.get("/", getAllUploads);

/**
 * ADMIN: Delete upload
 */
router.delete("/:id", adminProtect, deleteUpload);

module.exports = router;
