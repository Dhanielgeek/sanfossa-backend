const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const verifyTurnstile = require("../middleware/verifyTurnstile");
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resendVerificationOtp,
  resetPassword,
  getProfile,
  updateProfile,
} = require("../Controllers/authController");

// User auth routes. Admin auth lives separately in Routes/adminRoutes.js.
router.post("/register", verifyTurnstile, register);
router.post("/signup", verifyTurnstile, register);
router.post("/login", verifyTurnstile, login);
router.post(
  "/verify-email",
  verifyEmail
);

router.post(
  "/resend-verification-otp",
  resendVerificationOtp
);

router.post("/forgot-password", verifyTurnstile, forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile", protect, getProfile);
router.get("/me", protect, getProfile);
router.put("/updateprofile", protect, updateProfile);

module.exports = router;
