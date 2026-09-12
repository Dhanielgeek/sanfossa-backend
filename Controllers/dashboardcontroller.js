const ContinuityProduct = require("../Models/continuityProductSchema");
const Order = require("../Models/BooksOrdersModel");

exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      continuityLibraryCount,
      booksPurchasedCount,
      ordersPlacedCount,
      recentlyOpened,
     
    ] = await Promise.all([
      // My Continuity Library
      ContinuityProduct.countDocuments({
        user: userId,
      }),

      // Books Purchased
      Order.countDocuments({
        user: userId,
        status: "completed",
      }),

      // Orders Placed
      Order.countDocuments({
        user: userId,
      }),

      // Continue Reading
      ContinuityProduct.find({
        user: userId,
        progress: { $gt: 0 },
        progress: { $lt: 100 },
      })
        .sort({ updatedAt: -1 })
        .limit(3),

      // Reading Progress
      ContinuityProduct.find({
        user: userId,
        progress: { $gt: 0 },
      })
        .sort({ progress: -1 })
        .limit(3),
    ]);

    return res.status(200).json({
      success: true,

      stats: {
        continuityLibrary: continuityLibraryCount,
        booksPurchased: booksPurchasedCount,
        wishlist: 0,
        ordersPlaced: ordersPlacedCount,
      },

      continueReading: recentlyOpened,

      // readingProgress,

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

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};