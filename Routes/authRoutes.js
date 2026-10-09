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
  refreshSession,
} = require("../Controllers/authController");

// User auth routes. Admin auth lives separately in Routes/adminRoutes.js.
// Forms that bots target (sign-up, sign-in, password reset) require a
// Cloudflare Turnstile token; the frontend renders the widget on each.

router.post("/register", verifyTurnstile, register);

router.post("/login", verifyTurnstile, login);

router.post("/verify-email", verifyEmail);

router.post("/resend-verification-otp", resendVerificationOtp);

router.post("/forgot-password", verifyTurnstile, forgotPassword);

router.post("/reset-password", resetPassword);

router.get("/profile", protect, getProfile);

router.get("/me", protect, getProfile);

router.put("/updateprofile", protect, updateProfile);

// Extend a still-valid session ("Are you still there?" prompt).
router.post("/refresh", protect, refreshSession);

module.exports = router;