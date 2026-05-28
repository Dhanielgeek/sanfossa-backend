const path = require("path");
const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

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

class UnsupportedFileTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedFileTypeError";
    this.statusCode = 415;
  }
}

const sanitizePublicId = (value) => {
  if (!value) return undefined;

  const parsed = path.parse(value);
  return parsed.name
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
};

const getExtension = (file = {}) => {
  const originalName = file.originalname || file.name || "";
  return path.extname(originalName).toLowerCase();
};

const detectFileType = (file = {}) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = getExtension(file);

  if (PDF_MIME_TYPES.has(mimetype) || extension === ".pdf") {
    return {
      kind: "pdf",
      resourceType: "raw",
      format: "pdf",
      deliveryType: "upload",
    };
  }

  if (mimetype.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
    return {
      kind: "image",
      resourceType: "image",
      deliveryType: "upload",
    };
  }

  if (
    mimetype.startsWith("video/") ||
    mimetype.startsWith("audio/") ||
    VIDEO_EXTENSIONS.has(extension) ||
    AUDIO_EXTENSIONS.has(extension)
  ) {
    return {
      kind:
        mimetype.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)
          ? "audio"
          : "video",
      resourceType: "video",
      deliveryType: "upload",
    };
  }

  throw new UnsupportedFileTypeError(
    `Unsupported file type: ${file.mimetype || "unknown"} ${extension || ""}`.trim(),
  );
};

const normalizeCloudinaryDeliveryUrl = (url) => {
  if (!url || typeof url !== "string") return url;

  return url.replace("/upload/fl_attachment:false/", "/upload/");
};

const makeCloudinaryPreviewUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  if (url.includes("/upload/fl_attachment:false/")) return url;

  return url.replace("/upload/", "/upload/fl_attachment:false/");
};

const streamUpload = (buffer, uploadOptions) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          error.statusCode = error.http_code || error.statusCode || 502;
          return reject(error);
        }

        return resolve({
          ...result,
          secure_url: normalizeCloudinaryDeliveryUrl(result.secure_url),
          url: normalizeCloudinaryDeliveryUrl(result.url),
        });
      },
    );

    streamifier.createReadStream(buffer).on("error", reject).pipe(stream);
  });

const uploadFileToCloudinary = async (file, options = {}) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error("A valid uploaded file buffer is required");
    error.statusCode = 400;
    throw error;
  }

  let detected;

  try {
    detected = detectFileType(file);
  } catch (error) {
    if (!options.resourceType) throw error;

    detected = {
      kind: options.kind || options.resourceType,
      resourceType: options.resourceType,
      format: options.format,
      deliveryType: "upload",
    };
  }

  if (options.resourceType && options.resourceType !== detected.resourceType) {
    throw new UnsupportedFileTypeError(
      `Expected a ${options.resourceType} upload but received ${detected.kind}`,
    );
  }

  const uploadOptions = {
    folder: options.folder || "uploads",
    resource_type: detected.resourceType,
    type: "upload",
    access_mode: options.access_mode || "public",
    public_id: sanitizePublicId(options.publicId || file.originalname),
    use_filename: true,
    unique_filename: options.uniqueFilename !== false,
    overwrite: options.overwrite === true,
  };

  if (detected.format || options.format) {
    uploadOptions.format = options.format || detected.format;
  }

  const result = await streamUpload(file.buffer, uploadOptions);

  return {
    ...result,
    kind: detected.kind,
    resourceType: detected.resourceType,
    deliveryType: "upload",
    publicUrl: result.secure_url,
  };
};

const uploadBufferToCloudinary = async (fileBuffer, options = {}) => {
  const file = {
    buffer: fileBuffer,
    mimetype: options.mimetype,
    originalname: options.originalname || options.publicId,
  };

  return uploadFileToCloudinary(file, options);
};

module.exports = {
  UnsupportedFileTypeError,
  detectFileType,
  makeCloudinaryPreviewUrl,
  normalizeCloudinaryDeliveryUrl,
  uploadFileToCloudinary,
  uploadBufferToCloudinary,
};
