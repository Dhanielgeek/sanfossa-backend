const express = require("express");
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  verify, // optional for double opt-in
} = require("../Controllers/subscribeController");

// POST /api/v1/subscribers/subscribe
router.post("/subscribe", subscribe);

// POST /api/v1/subscribers/unsubscribe
router.post("/unsubscribe", unsubscribe);

// GET /// GET /api/v1/subscribers/verify?email=...&token=... (optional)
router.get("/verify", verify);

module.exports = router;
