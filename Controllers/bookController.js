const Book = require("../Models/BooksModel");
const uploadToCloudinary = require("../utill/uploadToCloudinary");

/**
 * CREATE BOOK (ADMIN)
 */
exports.createBook = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required",
      });
    }

    const uploadedImage = await uploadToCloudinary(req.file.buffer, "stories");

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

      coverImage: uploadedImage.secure_url,
      status: req.body.status || "draft",
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: book,
    });
  } catch (error) {
    res.status(500).json({
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

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(
        req.file.buffer,
        "stories"
      );
      updates.coverImage = uploadedImage.secure_url;
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
      data: book,
    });
  } catch (error) {
    res.status(400).json({
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
      data: books,
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
      data: books,
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
    const book = await Book.findOne({
      _id: req.params.id,
      status: "published",
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    res.status(200).json({
      success: true,
      data: book,
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
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
