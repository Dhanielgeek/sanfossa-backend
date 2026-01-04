const Blog = require("../Models/BlogModel");
const uploadToCloudinary = require("../utill/uploadToCloudinary");

exports.createBlog = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Featured image is required",
      });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, "blogs");

    const { status, publishDate } = req.body;

    let finalPublishDate = null;
    let publishedAt = null;

    if (status === "published") {
      finalPublishDate = new Date();
      publishedAt = new Date();
    }

    if (status === "scheduled") {
      if (!publishDate) {
        return res.status(400).json({
          success: false,
          message: "Publish date is required for scheduled posts",
        });
      }

      finalPublishDate = new Date(publishDate);
    }

    const blog = await Blog.create({
      ...req.body,
      featuredImage: uploadResult.secure_url,
      tags: req.body.tags
        ? req.body.tags.split(",").map((tag) => tag.trim())
        : [],
      createdBy: req.admin._id,
      publishDate: finalPublishDate,
      publishedAt,
    });

    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * @desc Get all published blogs (Public)
 */
exports.getPublicBlogs = async (req, res) => {
  const blogs = await Blog.find({
    status: "published",
    publishedAt: { $ne: null },
  }).sort({ publishedAt: -1 });

  res.json({ success: true, data: blogs });
};

/**
 * @desc Get single blog (Public)
 */
exports.getSingleBlog = async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog || blog.status !== "published") {
    return res.status(404).json({ success: false, message: "Blog not found" });
  }

  res.json({ success: true, data: blog });
};

/**
 * @desc Admin get all blogs (Draft + Published)
 */
exports.getAllBlogsAdmin = async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json({ success: true, data: blogs });
};

/**
 * @desc Update blog (Admin)
 */
exports.updateBlog = async (req, res) => {
  try {
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, "blogs");
      req.body.featuredImage = uploadResult.secure_url;
    }

    if (req.body.tags) {
      req.body.tags = req.body.tags.split(",").map((tag) => tag.trim());
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * @desc Delete blog (Admin)
 */
exports.deleteBlog = async (req, res) => {
  await Blog.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Blog deleted" });
};
