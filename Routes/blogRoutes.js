const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { adminProtect } = require("../middleware/authAdmin");

const {
  createBlog,
  getPublicBlogs,
  getSingleBlog,
  getAllBlogsAdmin,
  updateBlog,
  deleteBlog,
} = require("../Controllers/blogController");

/* ---------- PUBLIC ---------- */
router.get("/", getPublicBlogs);
router.get("/:id", getSingleBlog);

/* ---------- ADMIN ---------- */
router.post("/", adminProtect, upload.single("featuredImage"), createBlog);

router.get("/admin/all", adminProtect, getAllBlogsAdmin);

router.put("/:id", adminProtect, upload.single("featuredImage"), updateBlog);

router.delete("/:id", adminProtect, deleteBlog);

module.exports = router;
