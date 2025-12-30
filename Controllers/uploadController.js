const Upload = require("../Models/Uploadmodel");
const uploadToCloudinary = require("../utill/uploadToCloudinary");

/**
 * @desc    Admin upload 1–3 images with description
 * @route   POST /api/uploads
 * @access  Admin
 */
exports.createUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one image is required",
      });
    }

    if (req.files.length > 3) {
      return res.status(400).json({
        success: false,
        error: "Maximum of 3 images allowed",
      });
    }

    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: "Description is required",
      });
    }

    const parsedDescription = JSON.parse(description);

    const uploadedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      const result = await uploadToCloudinary(file.buffer, "admin_uploads");

      uploadedImages.push({
        public_id: result.public_id,
        url: result.secure_url,
        description: parsedDescription[i],
      });
    }

    const upload = await Upload.create({
      images: uploadedImages,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      data: upload,
    });
  } catch (error) {
    console.error(error);
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
