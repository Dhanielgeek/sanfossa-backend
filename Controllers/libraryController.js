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
    });

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
