const express = require("express");
const router = express.Router();
const Order = require("../Models/BooksOrdersModel");
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

    const order = await Order.create({
      items,
      userInfo,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
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

module.exports = router;
