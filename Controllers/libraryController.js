const Library = require("../Models/LibraryModel");

exports.getUserLibrary = async (req, res) => {
  try {
    const { email } = req.params;

    const library = await Library.find({ email }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: library.length,
      data: library,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getAllLibrary = async (req, res) => {
  try {
    const library = await Library.find()
      .populate("book")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: library.length,
      data: library,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
