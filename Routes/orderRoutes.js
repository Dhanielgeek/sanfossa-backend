const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { adminProtect } = require("../middleware/authAdmin");

/**
 * -----------------------------------
 * POST /api/v1/orders
 * Guest checkout (NO AUTH REQUIRED)
 * -----------------------------------
 */
router.post("/", async (req, res) => {
  try {
    const { items, userInfo } = req.body;

    // ---- Validation ----
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No items provided" });
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

    // ---- Stock Check & Update ----
    for (const item of items) {
      const bookId = item.book?._id || item.book;

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid book ID" });
      }

      const book = await Book.findById(bookId);
      if (!book) {
        return res
          .status(404)
          .json({ success: false, error: "Book not found" });
      }

      if (book.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${book.title}`,
        });
      }

      book.stockQuantity -= item.quantity;
      await book.save();
    }

    // ---- Create Order ----
    const order = await Order.create({
      items,
      userInfo,
    });

    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while creating order",
    });
  }
});

/**
 * -----------------------------------
 * GET /api/v1/orders
 * ADMIN – View ALL orders
 * -----------------------------------
 */
router.get("/all", adminProtect, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "items.book",
        select: "title price coverImage",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while fetching orders",
    });
  }
});

module.exports = router;
