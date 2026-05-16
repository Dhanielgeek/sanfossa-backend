const Library = require("../Models/LibraryModel");

/**
 * =========================================
 * GET USER LIBRARY
 * =========================================
 */
exports.getUserLibrary = async (req, res) => {
  try {
    const { email } = req.params;

    const normalizedEmail = email.toLowerCase().trim();
    const currentLibrary = await Library.findOne({
      email: normalizedEmail,
      schemaVersion: 2,
    });

    if (currentLibrary) {
      return res.status(200).json({
        success: true,
        count: currentLibrary.books.length,
        data: currentLibrary,
      });
    }

    const legacyLibrary = await Library.find({
      email: normalizedEmail,
      schemaVersion: { $ne: 2 },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: legacyLibrary.length,
      data: legacyLibrary,
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
