
const User = require("../Models/userModel");
const Order = require("../Models/BooksOrdersModel");
const BooksModel = require("../Models/BooksModel");

// GET USER DASHBOARD
exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // --------------------------------------------------
    // USER
    // --------------------------------------------------
    const user = await User.findById(userId).select(
      "name email wishlist continuityLibrary"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // --------------------------------------------------
    // BOOKS PURCHASED
    // --------------------------------------------------
    const completedOrders = await Order.find({
      user: userId,
      status: "Completed",
    })
      .populate({
        path: "items.book",
        select: "title author coverImage price",
      })
      .sort({ createdAt: -1 });

    const booksPurchased = [];

    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.book) {
          booksPurchased.push({
            _id: item.book._id,
            title: item.book.title,
            author: item.book.author,
            coverImage: item.book.coverImage,
            price: item.book.price,
            quantity: item.quantity,
            purchasedAt: order.createdAt,
            orderId: order._id,
          });
        }
      });
    });

    // --------------------------------------------------
    // ORDERS PLACED
    // --------------------------------------------------
    const ordersPlaced = await Order.find({
      user: userId,
    })
      .populate({
        path: "items.book",
        select: "title coverImage",
      })
      .sort({ createdAt: -1 });

    const formattedOrders = ordersPlaced.map((order) => ({
      _id: order._id,
      orderNumber: order.paymentReference
        ? order.paymentReference
        : `ORD-${String(order._id).slice(-6).toUpperCase()}`,
      items: order.items.map((item) => ({
        book: item.book,
        quantity: item.quantity,
      })),
      totalAmount: order.totalAmount || 0,
      status: order.status,
      createdAt: order.createdAt,
    }));

    // --------------------------------------------------
    // CONTINUITY LIBRARY
    // --------------------------------------------------
    const continuityLibrary = user.continuityLibrary || [];

    // --------------------------------------------------
    // WISHLIST
    // --------------------------------------------------
    const wishlist = user.wishlist || [];

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------
    return res.status(200).json({
      success: true,
      data: {
        continuityLibrary,
        booksPurchased,
        wishlist,
        ordersPlaced: formattedOrders,
      },
    });
  } catch (error) {
    console.error("Get user dashboard error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load user dashboard",
    });
  }
};

