const path = require("path");
const { UTApi, UTFile } = require("uploadthing/server");
const Media = require("../Models/MediaModel");

const utapi = new UTApi();

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".flac",
  ".webm",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".webm",
  ".3gp",
  ".mpeg",
  ".mpg",
]);

const PDF_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);

const detectFileType = (file = {}) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (PDF_MIME_TYPES.has(mimetype) || extension === ".pdf") return "pdf";
  if (mimetype.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (mimetype.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (mimetype.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return "video";

  const error = new Error(
    `Unsupported file type: ${file.mimetype || "unknown"} ${extension || ""}`.trim(),
  );
  error.statusCode = 415;
  throw error;
};

const uploadFileToUploadThing = async (file, metadata = {}) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error("A valid uploaded file buffer is required");
    error.statusCode = 400;
    throw error;
  }

  const uploadThingFile = new UTFile([file.buffer], file.originalname, {
    type: file.mimetype,
  });

  const [response] = await utapi.uploadFiles([uploadThingFile], {
    acl: "public-read",
    contentDisposition: "inline",
    metadata,
  });

  if (response?.error) {
    const error = new Error(response.error.message || "UploadThing upload failed");
    error.statusCode = 502;
    error.details = response.error;
    throw error;
  }

  const publicUrl = response?.data?.ufsUrl || response?.data?.url;

  if (!publicUrl || !response?.data?.key) {
    const error = new Error("UploadThing upload did not return a public file URL");
    error.statusCode = 502;
    throw error;
  }

  return {
    ...response.data,
    publicUrl,
  };
};

exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "A file is required" });
    }

    const fileType = detectFileType(req.file);

    const result = await uploadFileToUploadThing(req.file, {
      uploadedBy: String(req.admin?._id || req.admin?.id || ""),
      fileType,
    });

    const media = await Media.create({
      title: String(req.body.title || "").trim(),
      description: String(req.body.description || "").trim(),
      originalName: req.file.originalname,
      fileType,
      mimeType: req.file.mimetype,
      url: result.publicUrl,
      viewUrl: result.publicUrl,
      publicId: result.key,
      fileSize: result.size || req.file.size,
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

    if (media.publicId) {
      try {
        await utapi.deleteFiles(media.publicId);
      } catch (error) {
        console.warn("UploadThing file deletion skipped:", error.message);
      }
    }

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
