const {
  uploadBufferToCloudinary,
} = require("../services/cloudinaryUploadService");

const uploadToCloudinary = (fileBuffer, options = {}) => {
  const normalizedOptions =
    typeof options === "string" ? { folder: options } : options;

  return uploadBufferToCloudinary(fileBuffer, {
    folder: "media",
    access_mode: "public",
    ...normalizedOptions,
  });
};

module.exports = uploadToCloudinary;
