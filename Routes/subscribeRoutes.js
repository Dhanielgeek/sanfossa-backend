const express = require("express");
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  getSubscribers,
  verify, // optional for double opt-in
} = require("../Controllers/subscribeController");

const { adminProtect } = require("../middleware/authAdmin");

// POST /api/v1/subscribers/subscribe
router.post("/subscribe", subscribe);

// GET /api/v1/subscribers/all (admin only)
router.get("/all", adminProtect, getSubscribers);

// POST /api/v1/subscribers/unsubscribe
router.post("/unsubscribe", unsubscribe);

// GET /// GET /api/v1/subscribers/verify?email=...&token=... (optional)
router.get("/verify", verify);

module.exports = router;
