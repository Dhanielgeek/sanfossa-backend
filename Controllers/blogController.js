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

    const blog = await Blog.create({
      ...req.body,
      featuredImage: uploadResult.secure_url,
      tags: req.body.tags
        ? req.body.tags.split(",").map((tag) => tag.trim())
        : [],
      createdBy: req.admin._id,
      publishDate: req.body.status === "published" ? new Date() : null,
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
  const blogs = await Blog.find({ status: "published" }).sort({
    createdAt: -1,
  });

  res.json({ success: true, data: blogs });
};

/**
 * @desc Get RSS feed for latest published blogs
 */
exports.getRssFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const blogs = await Blog.find({ status: "published" })
      .sort({ publishDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const feedTitle = process.env.SITE_NAME || "Blog Feed";
    const feedDescription = process.env.SITE_DESCRIPTION || "Latest posts";

    const itemsXml = blogs
      .map((b) => {
        const link = `${siteUrl}/blog/${b._id}`;
        const pubDate = b.publishDate ? new Date(b.publishDate).toUTCString() : new Date(b.createdAt).toUTCString();
        const description = (b.excerpt || b.content || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const title = (b.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const guid = `${link}`;
        const enclosure = b.featuredImage ? `<enclosure url="${b.featuredImage}" type="image/jpeg"/>` : "";

        return `
      <item>
        <title>${title}</title>
        <link>${link}</link>
        <guid isPermaLink="true">${guid}</guid>
        <pubDate>${pubDate}</pubDate>
        <description><![CDATA[${description}]]></description>
        ${enclosure}
      </item>`;
      })
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>${feedTitle}</title>
      <link>${siteUrl}</link>
      <description>${feedDescription}</description>
      <language>en-us</language>
      ${itemsXml}
    </channel>
  </rss>`;

    res.type("application/rss+xml");
    return res.send(rss);
  } catch (err) {
    console.error("[RSS][ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to generate RSS feed" });
  }
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

exports.trackBlogView = async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { _id: req.params.id, status: "published" },
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "View tracked",
      data: {
        views: blog.views,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to track view",
    });
  }
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
