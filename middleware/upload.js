const multer = require("multer");
const { detectFileType } = require("../services/cloudinaryUploadService");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  try {
    detectFileType(file);
    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE_MB || 100) * 1024 * 1024 },
});
