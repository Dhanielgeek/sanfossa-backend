const Library = require("../Models/LibraryModel");

/**
 * =========================================
 * GET USER LIBRARY
 * =========================================
 */
exports.getMyLibrary = async (req, res) => {
  try {
    const library = await Library.findOne({
      userId: req.user._id,
      schemaVersion: 2,
    }).populate("books.bookId");

    if (!library) {
      return res.status(404).json({
        success: false,
        message: "Library not found",
      });
    }

    return res.status(200).json({
      success: true,
      count: library.books.length,
      data: library,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * =========================================
 * GET ALL LIBRARIES
 * =========================================
 */
exports.getAllLibrary = async (req, res) => {
  try {
    const library = await Library.find({ schemaVersion: 2 }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: library.length,
      data: library,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/** * =========================================
 * Ensure ORDER BOOKS IN LIBRARY
 * =========================================
 */
exports.ensureOrderBooksInLibrary = async ({ order }) => {
  let library = await Library.findOne({
    userId: order.userId,
    schemaVersion: 2,
  });

  if (!library) {
    library = await Library.create({
      userId: order.userId,
      schemaVersion: 2,
      books: [],
    });
  }

  // Add books (avoid duplicates)
  const existingBookIds = new Set(library.books.map((b) => String(b.bookId)));

  order.items.forEach((item) => {
    if (!existingBookIds.has(String(item.book))) {
      library.books.push({
        bookId: item.book,
        purchasedAt: new Date(),
      });
    }
  });

  await library.save();

  return library;
};

exports.getLibraryByUserId = async (req, res) => {
  try {
    const library = await Library.findOne({
      userId: req.params.id,
      schemaVersion: 2,
    }).populate("books.bookId");

    return res.status(200).json({
      success: true,
      data: library || { books: [] },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
