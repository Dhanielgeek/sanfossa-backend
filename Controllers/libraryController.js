const Library = require("../Models/LibraryModel");

/**
 * =========================================
 * GET USER LIBRARY
 * =========================================
 */
exports.getUserLibrary = async (req, res) => {
  try {
    const { email } = req.params;

    const library = await Library.find({
      email: email.toLowerCase(),
    }).sort({
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

/**
 * =========================================
 * GET ALL LIBRARIES
 * =========================================
 */
exports.getAllLibrary = async (req, res) => {
  try {
    const library = await Library.find().sort({
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
