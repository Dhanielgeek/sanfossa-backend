const Library = require("../Models/LibraryModel");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

/**
 * =========================================
 * GET USER LIBRARY
 * =========================================
 */
exports.getMyLibrary = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const email = normalizeEmail(req.user && req.user.email);

    console.log("[LIBRARY][ME] req.user:", {
      id: userId ? String(userId) : null,
      email,
    });

    let library = await Library.findOne({
      userId,
      schemaVersion: 2,
    }).populate("books.bookId");

    console.log("[LIBRARY][ME] userId query result:", {
      found: Boolean(library),
      libraryId: library ? String(library._id) : null,
      libraryUserId: library && library.userId ? String(library.userId) : null,
      bookCount: library ? library.books.length : 0,
    });

    if (!library && email) {
      library = await Library.findOne({
        email,
        schemaVersion: 2,
      }).populate("books.bookId");

      console.log("[LIBRARY][ME] email fallback result:", {
        found: Boolean(library),
        libraryId: library ? String(library._id) : null,
        libraryUserId:
          library && library.userId ? String(library.userId) : null,
        bookCount: library ? library.books.length : 0,
      });

      if (library && !library.userId && userId) {
        library.userId = userId;
        await library.save();
        console.log("[LIBRARY][ME] backfilled missing userId:", {
          libraryId: String(library._id),
          userId: String(userId),
        });
      }
    }

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

    console.log("[LIBRARY][ALL] result:", {
      count: library.length,
      missingUserId: library.filter((item) => !item.userId).length,
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
  console.log("[LIBRARY][LEGACY_ENSURE] input:", {
    orderId: order && order._id ? String(order._id) : null,
    orderUser: order && order.user ? String(order.user) : null,
    orderUserId: order && order.userId ? String(order.userId) : null,
  });

  let library = await Library.findOne({
    userId: order.user || order.userId,
    schemaVersion: 2,
  });

  if (!library) {
    library = await Library.create({
      userId: order.user || order.userId,
      email: normalizeEmail(order.userInfo && order.userInfo.email),
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

  console.log("[LIBRARY][LEGACY_ENSURE] output:", {
    libraryId: String(library._id),
    userId: library.userId ? String(library.userId) : null,
    schemaVersion: library.schemaVersion,
    bookCount: library.books.length,
  });

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
