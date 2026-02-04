// controllers/orderController.js (Logic for POST /api/v1/orders)

const mongoose = require("mongoose");

const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");

// ... imports for Order and Book models

exports.createOrder = async (req, res) => {
  const { items, userInfo } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: "No items provided" });
  }
  if (
    !userInfo ||
    !userInfo.name ||
    !userInfo.email ||
    !userInfo.phone ||
    !userInfo.address
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Incomplete user info" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- Decrement stock safely ---
    for (const item of items) {
      const book = await Book.findById(item.book).session(session);
      if (!book) throw new Error(`Book not found: ${item.book}`);
      if (book.stockQuantity < item.quantity)
        throw new Error(`Insufficient stock for: ${book.title}`);

      await Book.findByIdAndUpdate(
        item.book,
        { $inc: { stockQuantity: -item.quantity } },
        { session },
      );
    }

    // --- Create order ---
    const order = await Order.create([{ items, userInfo }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: order[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, error: error.message });
  }
};
