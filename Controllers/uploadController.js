const Upload = require("../Models/Uploadmodel");
const uploadToCloudinary = require("../utill/uploadToCloudinary");
/**
 * @desc    Admin upload 2–3 images with descriptions
 * @route   POST /api/uploads
 * @access  Admin
 */
exports.createUpload = async (req, res) => {
  try {
    // 1️⃣ Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one image is required",
      });
    }

    if (req.files.length < 2 || req.files.length > 3) {
      return res.status(400).json({
        success: false,
        error: "You can only upload 2–3 images",
      });
    }

    // 2️⃣ Get descriptions (plural – matches frontend)
    let descriptions = req.body.descriptions || [];

    // If only one description, force array
    if (!Array.isArray(descriptions)) {
      descriptions = [descriptions];
    }

    // 3️⃣ Ensure each image has a description
    if (descriptions.length !== req.files.length) {
      return res.status(400).json({
        success: false,
        error: "Each image must have a description",
      });
    }

    // 4️⃣ Upload images to Cloudinary
    const uploadedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      const result = await uploadToCloudinary(file.buffer, "admin_uploads");

      uploadedImages.push({
        public_id: result.public_id,
        url: result.secure_url,
        description: descriptions[i],
      });
    }

    // 5️⃣ Save to DB
    const upload = await Upload.create({
      images: uploadedImages,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      data: upload,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * @desc    Get all uploads
 * @route   GET /api/uploads
 * @access  Admin
 */
exports.getAllUploads = async (req, res) => {
  try {
    const uploads = await Upload.find()
      .populate("createdBy", "fullname email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: uploads.length,
      data: uploads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * @desc    Delete upload (and images)
 * @route   DELETE /api/uploads/:id
 * @access  Admin
 */
exports.deleteUpload = async (req, res) => {
  try {
    const upload = await Upload.findById(req.params.id);

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: "Upload not found",
      });
    }

    // delete all images from cloudinary
    for (const img of upload.images) {
      await cloudinary.uploader.destroy(img.public_id);
    }

    await upload.deleteOne();

    res.status(200).json({
      success: true,
      message: "Upload deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteImageById = async (req, res) => {
  try {
    const { imageId } = req.params;

    // Find upload that contains this image
    const upload = await Upload.findOne({
      "images._id": imageId,
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    // Find the image
    const image = upload.images.find((img) => img._id.toString() === imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        error: "Image not found",
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(image.public_id);

    // Remove image from array
    upload.images = upload.images.filter(
      (img) => img._id.toString() !== imageId
    );

    await upload.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
