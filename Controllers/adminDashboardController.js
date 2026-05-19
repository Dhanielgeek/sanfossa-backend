const User = require("../Models/userModel");
const Order = require("../Models/BooksOrdersModel");
const Blog = require("../Models/BlogModel");
const Subscriber = require("../Models/Subscriber");

const BooksModel = require("../Models/BooksModel");

// Helper: percentage change
const calcChange = (current, previous) => {
  if (!previous || previous === 0) return "+0%";
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
};

exports.getAdminDashboard = async (req, res) => {
  try {
    /* ---------- USERS ---------- */
    const totalUsers = await User.countDocuments();

    /* ---------- ORDERS ---------- */
    const totalOrders = await Order.countDocuments();
    const revenueAgg = await Order.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const revenue = revenueAgg[0]?.total || 0;

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber customerName items totalAmount status");

    /* ---------- BLOG ---------- */
    const blogs = await Blog.find({ status: "published" });
    const totalBlogViews = blogs.reduce(
      (sum, blog) => sum + (blog.views || 0),
      0,
    );

    const popularPosts = await Blog.find({ status: "published" })
      .sort({ views: -1 })
      .limit(4)
      .select("title views publishDate");

    /* ---------- BOOKS ---------- */

    const books = await BooksModel.find({ status: "published" });
    const totalBookViews = books.reduce(
      (sum, book) => sum + (book.views || 0),
      0,
    );

    /* ---------- NEWSLETTER ---------- */
    const subscribers = await Subscriber.countDocuments();

    // Static placeholders for now (until email provider analytics)
    const newsletterStats = {
      subscribers,
      openRate: "42.3%",
      clickRate: "18.7%",
      lastSent: "2 days ago",
    };

    /* ---------- RESPONSE ---------- */
    res.json({
      success: true,
      data: {
        stats: {
          users: {
            value: totalUsers,
            change: calcChange(totalUsers, totalUsers - 20),
          },
          orders: {
            value: totalOrders,
            change: calcChange(totalOrders, totalOrders - 10),
          },
          revenue: {
            value: revenue,
            change: "+0%",
          },
          blogViews: {
            value: totalBlogViews,
            change: "+0%",
          },
          bookViews: {
            value: totalBookViews,
            change: "+0%",
          },
        },

        recentOrders,
        popularPosts,
        newsletter: newsletterStats,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Failed to load admin dashboard",
    });
  }
};
