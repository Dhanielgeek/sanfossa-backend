// Routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../Models/userModel"); // Make sure your User model has fields: name, email, password, role
const { protect } = require("../middleware/auth");

// Helper to generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// @route POST /apiauth/register
// @desc  Register a new user
// @access Public
router.post("/register", async (req, res) => {
  const { fullname, email, password, role } = req.body;

  if (!fullname || !email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "All fields required" });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res
        .status(400)
        .json({ success: false, error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullname,
      email,
      password,
      role: role || "user",
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route POST /apiauth/login
// @desc  Login user
// @access Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Email and password required" });
  }

  try {
    // 👇 explicitly select password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route GET /apiauth/profile
// @desc  Get logged-in user profile
// @access Private
router.get("/profile", protect, async (req, res) => {
  const user = req.user;
  res.status(200).json({ success: true, data: user });
});

module.exports = router;
