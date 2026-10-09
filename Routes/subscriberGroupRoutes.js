// routes/subscriberGroup.routes.js
const express = require("express");
const router = express.Router();
const {
  createSubscriberGroup,
  updateSubscriberGroup,
} = require("../Controllers/subscriberGroup.controller");
const { adminProtect } = require("../middleware/authAdmin");

/**
 * Create a new Subscriber Group
 * POST /api/subscriber-groups
 * Body: { id, name }
 */
router.post("/subscriber-groups", adminProtect, createSubscriberGroup);

/**
 * Update a Subscriber Group by its external id
 * PATCH /api/subscriber-groups/:id
 * Body: { name?, id? }
 */
router.patch("/subscriber-groups/:id", adminProtect, updateSubscriberGroup);

module.exports = router;
