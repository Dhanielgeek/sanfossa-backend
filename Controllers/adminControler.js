const Admin = require("../Models/Adminmodel");
const jwt = require("jsonwebtoken");
const User = require("../Models/userModel");

const generateToken = (id) =>
  jwt.sign({ id, type: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

/**
 * @desc Register admin
 * @route POST /apiadmin/register
 */
exports.registerAdmin = async (req, res) => {
  const { fullname, email, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "All fields are required",
    });
  }

  try {
    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        error: "Admin already exists",
      });
    }

    const admin = await Admin.create({
      fullname,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: admin._id,
        fullname: admin.fullname,
        email: admin.email,
        role: admin.role,
        token: generateToken(admin._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * @desc Login admin
 * @route POST /apiadmin/login
 */
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    res.json({
      success: true,
      data: {
        _id: admin._id,
        fullname: admin.fullname,
        email: admin.email,
        role: admin.role,
        token: generateToken(admin._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password") // extra safety
      .sort({ createdAt: -1 });

    // Format users for frontend table
    const formattedUsers = users.map((user) => ({
      id: user._id,
      name: user.fullname,
      email: user.email,
      role:
        user.role === "admin"
          ? "Admin"
          : user.role === "editor"
          ? "Editor"
          : "User",
      status: "Active", // all users are active unless you add isActive later
      joined: user.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      orders: 0, // placeholder (until Orders model exists)
    }));

    // Stats for top cards
    const totalUsers = users.length;
    const activeUsers = users.length; // since no isActive field yet
    const admins = users.filter((u) => u.role === "admin").length;

    const newThisMonth = users.filter((u) => {
      const now = new Date();
      return (
        u.createdAt.getMonth() === now.getMonth() &&
        u.createdAt.getFullYear() === now.getFullYear()
      );
    }).length;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        newThisMonth,
        admins,
      },
      data: formattedUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

/**
 * @desc Admin profile
 * @route GET /apiadmin/profile
 */
exports.getAdminProfile = async (req, res) => {
  res.json({
    success: true,
    data: req.admin,
  });
};
