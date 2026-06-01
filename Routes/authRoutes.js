const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  register,
  login,
  getProfile,
  updateProfile,
} = require("../Controllers/authController");

// User auth routes. Admin auth lives separately in Routes/adminRoutes.js.
router.post("/register", register);
router.post("/signup", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.get("/me", protect, getProfile);
router.put("/updateprofile", protect, updateProfile);

module.exports = router;
