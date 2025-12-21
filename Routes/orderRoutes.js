const express = require("express");
const router = express.Router();
const Order = require("../Models/BooksOrdersModel");
const { protect } = require("../middleware/auth"); // Only need 'protect' for logged-in user

// @route   POST /api/v1/orders
// @desc    Create a new sales order (Checkout)
// @access  Private (User must be logged in)
router.post("/", protect, async (req, res) => {
  // The controller logic here must also handle decrementing the stockQuantity of each book!
  try {
    // req.user.id is attached by the 'protect' middleware
    const order = await Order.create({ ...req.body, user: req.user.id });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// @route   GET /api/v1/orders/my
// @desc    Get all orders for the currently logged-in user
// @access  Private
router.get("/my", protect, async (req, res) => {
  try {
    // Find orders linked to the logged-in user ID, and 'populate' the book details
    const orders = await Order.find({ user: req.user.id }).populate({
      path: "items.book",
      select: "title price imageUrl",
    });

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router;
