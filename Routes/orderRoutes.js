const express = require("express");
const router = express.Router();
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { adminProtect } = require("../middleware/authAdmin");
const { protect } = require("../middleware/auth");
const { getMyPurchaseHistory } = require("../Controllers/orderController");

/**
 * -----------------------------------
 * POST /api/v1/orders
 * Authenticated checkout
 * -----------------------------------
 */
router.post("/", protect, async (req, res) => {
  try {
    const { items, userInfo } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No items provided",
      });
    }

    if (
      !userInfo ||
      !userInfo.name ||
      !userInfo.email ||
      !userInfo.phone ||
      !userInfo.address
    ) {
      return res.status(400).json({
        success: false,
        error: "Incomplete user info",
      });
    }

    const bookIds = items.map((item) => item.book);
    const books = await Book.find({
      _id: { $in: bookIds },
      status: "published",
    });
    const booksById = new Map(books.map((book) => [String(book._id), book]));

    const normalizedItems = items.map((item) => {
      const book = booksById.get(String(item.book));
      const quantity = Number(item.quantity);

      if (!book) {
        throw new Error(`Book not found or unavailable: ${item.book}`);
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Invalid item quantity");
      }

      return {
        book: book._id,
        quantity,
        priceAtPurchase: book.price,
      };
    });

    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const order = await Order.create({
      items: normalizedItems,
      userInfo: {
        ...userInfo,
        email: userInfo.email.toLowerCase().trim(),
      },
      user: req.user._id,
      totalAmount,
    });

    console.log("[ORDER][CREATE] created:", {
      orderId: String(order._id),
      user: order.user ? String(order.user) : null,
      email: order.userInfo.email,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return res
      .status(
        error.message.includes("Book") || error.message.includes("quantity")
          ? 400
          : 500,
      )
      .json({
        success: false,
        error:
          error.message.includes("Book") || error.message.includes("quantity")
            ? error.message
            : "Server error while creating order",
      });
  }
});

/**
 * -----------------------------------
 * GET /api/v1/orders/all
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

/**
 * -----------------------------------
 * DELETE /api/orders/delete-all
 * ADMIN – Delete ALL orders
 * -----------------------------------
 */

router.delete("/delete-all", adminProtect, async (req, res) => {
  try {
    const deleted = await Order.deleteMany({});

    return res.status(200).json({
      success: true,
      message: "All orders deleted successfully",
      deletedCount: deleted.deletedCount,
    });
  } catch (error) {
    console.error("DELETE ALL ORDERS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while deleting orders",
    });
  }
});

/**
 * -----------------------------------
 * GET /api/orders/purchase-history
 * USER – GET ALL orders
 * -----------------------------------
 */
router.get("/me", protect, getMyPurchaseHistory);

module.exports = router;
