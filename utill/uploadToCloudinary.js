const { uploadBufferToCloudinary } = require("../services/cloudinaryUploadService");

const uploadToCloudinary = (
  fileBuffer,
  options = {},
) => {
  const normalizedOptions =
    typeof options === "string" ? { folder: options, resourceType: "image" } : options;

  return uploadBufferToCloudinary(fileBuffer, {
    folder: "blogs",
    ...normalizedOptions,
  });
};

module.exports = uploadToCloudinary;
