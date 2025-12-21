const Book = require("../Models/BooksModel");
const { notifySubscribers } = require("../utill/notificationService");

// Create book
exports.createBook = async (req, res) => {
  try {
    const book = await Book.create(req.body);

    notifySubscribers("BOOK", book);

    res.status(201).json({
      success: true,
      message: "Book created and subscribers notified!",
      data: book,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ✅ ADD THIS
exports.updateInventory = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    book.quantity = quantity;
    await book.save();

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      data: book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
