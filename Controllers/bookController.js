const Book = require("../Models/BooksModel");
const Library = require("../Models/LibraryModel");
const {
  normalizeCloudinaryDeliveryUrl,
  uploadFileToCloudinary,
} = require("../services/cloudinaryUploadService");

const getFirstFile = (files, fieldName) => files?.[fieldName]?.[0];

const normalizeBookMediaUrls = (book) => {
  if (!book) return book;

  const data = typeof book.toObject === "function" ? book.toObject() : book;
  const fields = [
    "coverImage",
    "pdfFile",
    "audioFile",
    "videoFile",
    "mediaUrl",
    "audioUrl",
    "videoUrl",
  ];

  for (const field of fields) {
    if (data[field]) data[field] = normalizeCloudinaryDeliveryUrl(data[field]);
  }

  return data;
};

const normalizeBooksMediaUrls = (books) => books.map(normalizeBookMediaUrls);

const uploadBookFile = (file, folder, options = {}) =>
  uploadFileToCloudinary(file, {
    folder,
    ...options,
  });

/**
 * CREATE BOOK (ADMIN)
 */
exports.createBook = async (req, res) => {
  try {
    const coverImage = getFirstFile(req.files, "coverImage");

    if (!coverImage) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required",
      });
    }

    const coverUpload = await uploadBookFile(coverImage, "stories/covers", {
      resourceType: "image",
      kind: "image",
    });

    let pdfUrl = null;
    let audioUrl = null;
    let videoUrl = null;
    let mediaUrl = null;

    const pdfFile = getFirstFile(req.files, "pdfFile");
    if (pdfFile) {
      const pdfUpload = await uploadBookFile(pdfFile, "stories/pdfs", {
        resourceType: "raw",
        kind: "pdf",
        format: "pdf",
      });
      pdfUrl = pdfUpload.publicUrl;
    }

    const audioFile = getFirstFile(req.files, "audioFile");
    if (audioFile) {
      const audioUpload = await uploadBookFile(audioFile, "stories/audio", {
        resourceType: "video",
        kind: "audio",
      });
      audioUrl = audioUpload.publicUrl;
    }

    const videoFile = getFirstFile(req.files, "videoFile");
    if (videoFile) {
      const videoUpload = await uploadBookFile(videoFile, "stories/videos", {
        resourceType: "video",
        kind: "video",
      });
      videoUrl = videoUpload.publicUrl;
    }

    const mediaFile = getFirstFile(req.files, "mediaUrl");
    if (mediaFile) {
      const mediaUpload = await uploadBookFile(mediaFile, "stories/media");
      mediaUrl = mediaUpload.publicUrl;
    }

    mediaUrl = mediaUrl || videoUrl || audioUrl || pdfUrl || null;

    const book = await Book.create({
      title: req.body.title,
      subtitle: req.body.subtitle,
      summary: req.body.summary,
      content: req.body.content,
      author: req.body.author,
      narrator: req.body.narrator,
      category: req.body.category,
      tags: req.body.tags
        ? req.body.tags.split(",").map((tag) => tag.trim())
        : [],
      historicalPeriod: req.body.historicalPeriod,
      location: req.body.location,
      readingTime: Number(req.body.readingTime),
      ageRating: req.body.ageRating,
      price: Number(req.body.price) || 0,

      coverImage: coverUpload.publicUrl,
      pdfFile: pdfUrl,
      audioFile: audioUrl,
      videoFile: videoUrl,
      mediaUrl,
      audioUrl,
      videoUrl,

      status: req.body.status || "draft",
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: normalizeBookMediaUrls(book),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * UPDATE BOOK (ADMIN)
 */
exports.updateBook = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.tags) {
      updates.tags = updates.tags.split(",").map((tag) => tag.trim());
    }

    const coverImage = getFirstFile(req.files, "coverImage");
    if (coverImage) {
      const coverUpload = await uploadBookFile(coverImage, "stories/covers", {
        resourceType: "image",
        kind: "image",
      });
      updates.coverImage = coverUpload.publicUrl;
    }

    const pdfFile = getFirstFile(req.files, "pdfFile");
    if (pdfFile) {
      const pdfUpload = await uploadBookFile(pdfFile, "stories/pdfs", {
        resourceType: "raw",
        kind: "pdf",
        format: "pdf",
      });
      updates.pdfFile = pdfUpload.publicUrl;
    }

    const audioFile = getFirstFile(req.files, "audioFile");
    if (audioFile) {
      const audioUpload = await uploadBookFile(audioFile, "stories/audio", {
        resourceType: "video",
        kind: "audio",
      });
      updates.audioFile = audioUpload.publicUrl;
      updates.audioUrl = audioUpload.publicUrl;
    }

    const videoFile = getFirstFile(req.files, "videoFile");
    if (videoFile) {
      const videoUpload = await uploadBookFile(videoFile, "stories/videos", {
        resourceType: "video",
        kind: "video",
      });
      updates.videoFile = videoUpload.publicUrl;
      updates.videoUrl = videoUpload.publicUrl;
    }

    const mediaFile = getFirstFile(req.files, "mediaUrl");
    if (mediaFile) {
      const mediaUpload = await uploadBookFile(mediaFile, "stories/media");
      updates.mediaUrl = mediaUpload.publicUrl;
    }

    if (!updates.mediaUrl && (updates.videoFile || updates.audioFile || updates.pdfFile)) {
      updates.mediaUrl = updates.videoFile || updates.audioFile || updates.pdfFile;
    }

    if (updates.price) updates.price = Number(updates.price);
    if (updates.readingTime) updates.readingTime = Number(updates.readingTime);

    const book = await Book.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: normalizeBookMediaUrls(book),
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * DELETE BOOK (ADMIN)
 */
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    await book.deleteOne();

    res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET ALL BOOKS (ADMIN)
 */
exports.getAllBooksAdmin = async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: books.length,
      data: normalizeBooksMediaUrls(books),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET PUBLIC BOOKS
 */
exports.getPublicBooks = async (req, res) => {
  try {
    const books = await Book.find({ status: "published" })
      .select("-content")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: books.length,
      data: normalizeBooksMediaUrls(books),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET SINGLE PUBLIC BOOK
 */
exports.getSingleBook = async (req, res) => {
  try {
    const book = await Book.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "published",
      },
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      data: normalizeBookMediaUrls(book),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DOWNLOAD BOOK (FREE ONLY)
 */
exports.downloadBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (book.price > 0) {
      return res.status(403).json({
        success: false,
        message: "This book is paid. Please purchase to download.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        title: book.title,
        subtitle: book.subtitle,
        content: book.content,
        pdfFile: normalizeCloudinaryDeliveryUrl(book.pdfFile),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadPurchasedBook = async (req, res) => {
  try {
    const { email } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (book.price === 0) {
      return res.status(200).json({
        success: true,
        data: {
          pdfFile: normalizeCloudinaryDeliveryUrl(book.pdfFile),
        },
      });
    }

    const owned = await Library.findOne({
      email: normalizedEmail,
      schemaVersion: 2,
      "books.bookId": book._id,
    });

    if (!owned) {
      return res.status(403).json({
        success: false,
        message: "You have not purchased this book",
      });
    }

    const purchasedBook = owned.books.find(
      (entry) => String(entry.bookId) === String(book._id),
    );

    res.status(200).json({
      success: true,
      data: {
        pdfFile: normalizeCloudinaryDeliveryUrl(book.pdfFile),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.incrementBookView = async (req, res) => {
  try {
    const bookId = req.params.id;

    const book = await Book.findByIdAndUpdate(
      bookId,
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    return res.status(200).json({
      success: true,
      views: book.views,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.trackBookView = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await Book.findOneAndUpdate(
      { _id: id, status: "published" },
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "View tracked",
      data: {
        views: book.views,
      },
    });
  } catch (error) {
    console.error("Track view error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to track view",
    });
  }
};
