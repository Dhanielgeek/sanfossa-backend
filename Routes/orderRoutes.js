const express = require("express");
const router = express.Router();
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel"); // Make sure you have the Book model
const mongoose = require("mongoose");

// ----------------------
// POST /api/v1/orders (Guest Checkout)
// ----------------------
router.post("/", async (req, res) => {
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
    // Decrement stock safely
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

    // Create order
    const order = await Order.create([{ items, userInfo }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, data: order[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, error: error.message });
  }
});

// ----------------------
// GET /api/v1/orders/my (Optional: For logged-in users)
// ----------------------
// Keep this if you want a user to see their orders, but only applies to logged-in users
const { adminProtect } = require("../middleware/authAdmin");
router.get("/my", adminProtect, async (req, res) => {
  try {
    const orders = await Order.find({
      "userInfo.email": req.user.email,
    }).populate({
      path: "items.book",
      select: "title price coverImage",
    });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router;
