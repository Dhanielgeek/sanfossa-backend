const cloudinary = require("../config/cloudinary");
const Media = require("../Models/MediaModel");
const {
  uploadFileToCloudinary,
  detectFileType,
  makeCloudinaryPreviewUrl,
} = require("../services/cloudinaryUploadService");

exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "A file is required" });
    }

    const detected = detectFileType(req.file);

    const result = await uploadFileToCloudinary(req.file, {
      folder: "media",
    });

    console.log({ result });

    // PDFs get fl_attachment:false so the browser renders them inline
    const viewUrl =
      detected.kind === "pdf"
        ? makeCloudinaryPreviewUrl(result.secure_url)
        : result.secure_url;

    const media = await Media.create({
      title: String(req.body.title || "").trim(),
      description: String(req.body.description || "").trim(),
      originalName: req.file.originalname,
      fileType: detected.kind === "pdf" ? "pdf" : detected.kind,
      mimeType: req.file.mimetype,
      url: result.secure_url,
      viewUrl,
      publicId: result.public_id,
      fileSize: req.file.size,
      uploadedBy: req.admin?._id || req.admin?.id || null,
    });

    return res.status(201).json({ success: true, data: media });
  } catch (error) {
    console.error("Media upload error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};

exports.getAllMedia = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.fileType = req.query.type;

    const media = await Media.find(filter)
      .populate("uploadedBy", "fullname email")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: media.length, data: media });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch media",
    });
  }
};

exports.getSingleMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).populate(
      "uploadedBy",
      "fullname email",
    );

    if (!media) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    return res.status(200).json({ success: true, data: media });
  } catch (error) {
    return res.status(error.name === "CastError" ? 400 : 500).json({
      success: false,
      message:
        error.name === "CastError"
          ? "Invalid media id"
          : error.message || "Failed to fetch media",
    });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    const resourceType =
      media.fileType === "pdf"
        ? "raw"
        : media.fileType === "image"
          ? "image"
          : "video";

    await cloudinary.uploader.destroy(media.publicId, {
      resource_type: resourceType,
    });
    await media.deleteOne();

    return res
      .status(200)
      .json({ success: true, message: "Media deleted successfully" });
  } catch (error) {
    return res.status(error.name === "CastError" ? 400 : 500).json({
      success: false,
      message:
        error.name === "CastError"
          ? "Invalid media id"
          : error.message || "Failed to delete media",
    });
  }
};
