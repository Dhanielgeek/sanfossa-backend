const fs = require("fs/promises");
const cloudinary = require("../config/cloudinary");
const Pdf = require("../Models/Pdf");
const { makeCloudinaryPreviewUrl } = require("../services/cloudinaryUploadService");

const removeTempFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to remove temporary PDF:", error.message);
    }
  }
};

const sanitizePdf = (pdf) => ({
  _id: pdf._id,
  title: pdf.title,
  description: pdf.description,
  pdfUrl: pdf.pdfUrl,
  publicId: pdf.publicId,
  fileSize: pdf.fileSize,
  uploadedBy: pdf.uploadedBy,
  createdAt: pdf.createdAt,
});

exports.uploadPdf = async (req, res) => {
  let cloudinaryPublicId;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "A PDF file is required",
      });
    }

    const title = String(req.body.title || "").trim();

    if (!title) {
      await removeTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw",
      folder: "pdfs",
      type: "upload",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });
    cloudinaryPublicId = result.public_id;

    const pdf = await Pdf.create({
      title,
      description: String(req.body.description || "").trim(),
      pdfUrl: makeCloudinaryPreviewUrl(result.secure_url),
      publicId: result.public_id,
      fileSize: req.file.size,
      uploadedBy: req.user?._id || req.admin?._id || null,
      createdAt: new Date(),
    });

    await removeTempFile(req.file.path);

    return res.status(201).json({
      success: true,
      message: "PDF uploaded successfully",
      data: sanitizePdf(pdf),
    });
  } catch (error) {
    await removeTempFile(req.file?.path);

    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: "raw",
        });
      } catch (cleanupError) {
        console.error(
          "Failed to remove orphaned Cloudinary PDF:",
          cleanupError.message,
        );
      }
    }

    console.error("PDF upload error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "PDF upload failed",
    });
  }
};

exports.getAllPdfs = async (req, res) => {
  try {
    const pdfs = await Pdf.find()
      .populate("uploadedBy", "fullname email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pdfs.length,
      data: pdfs.map(sanitizePdf),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch PDFs",
    });
  }
};

exports.getSinglePdf = async (req, res) => {
  try {
    const pdf = await Pdf.findById(req.params.id).populate(
      "uploadedBy",
      "fullname email",
    );

    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: "PDF not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizePdf(pdf),
    });
  } catch (error) {
    return res.status(error.name === "CastError" ? 400 : 500).json({
      success: false,
      message:
        error.name === "CastError"
          ? "Invalid PDF id"
          : error.message || "Failed to fetch PDF",
    });
  }
};

exports.deletePdf = async (req, res) => {
  try {
    const pdf = await Pdf.findById(req.params.id);

    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: "PDF not found",
      });
    }

    const requesterId = req.user?._id?.toString();
    const ownerId = pdf.uploadedBy?.toString();
    const isAdmin = req.user?.role === "admin";

    if (!isAdmin && ownerId !== requesterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this PDF",
      });
    }

    await cloudinary.uploader.destroy(pdf.publicId, {
      resource_type: "raw",
    });

    await pdf.deleteOne();

    return res.status(200).json({
      success: true,
      message: "PDF deleted successfully",
    });
  } catch (error) {
    return res.status(error.name === "CastError" ? 400 : 500).json({
      success: false,
      message:
        error.name === "CastError"
          ? "Invalid PDF id"
          : error.message || "Failed to delete PDF",
    });
  }
};

exports.makePreviewReadyUrl = makeCloudinaryPreviewUrl;
