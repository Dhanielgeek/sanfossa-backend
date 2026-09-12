const ContinuityProduct = require("../Models/continuityProductSchema");
const Order = require("../Models/Order");
const Wishlist = require("../Models/Wishlist");

exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user._id;

    const [
      continuityLibraryCount,
      booksPurchasedCount,
      wishlistCount,
      ordersPlacedCount,
      recentlyOpened,
      readingProgress,
    ] = await Promise.all([
      // My Continuity Library
      ContinuityProduct.countDocuments(),

      // Books Purchased
      Order.countDocuments({
        user: userId,
        status: "completed",
      }),

      // Wishlist
      Wishlist.countDocuments({
        user: userId,
      }),

      // Orders Placed
      Order.countDocuments({
        user: userId,
      }),

      // Continue Reading
      ReadingProgress.find({ user: userId })
        .populate("product")
        .sort({ lastOpenedAt: -1 })
        .limit(3),

      // Reading Progress
      ReadingProgress.find({ user: userId })
        .populate("product")
        .sort({ percentage: -1 })
        .limit(3),
    ]);

    res.status(200).json({
      success: true,

      stats: {
        continuityLibrary: continuityLibraryCount,
        booksPurchased: booksPurchasedCount,
        wishlist: wishlistCount,
        ordersPlaced: ordersPlacedCount,
      },

      continueReading: recentlyOpened,

      readingProgress,

      insights: {
        recentActivity:
          "Opened Oral History Field Notes and saved a protected-resource bookmark.",

        recommendations:
          "Continue the Memory and Migration Workbook before starting the archive pathway.",

        preservedMaterials:
          "3 resource packets are ready for review in your continuity library.",
      },
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};