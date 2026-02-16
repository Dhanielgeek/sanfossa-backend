// routes/subscriberGroup.routes.js
const express = require("express");
const router = express.Router();
const {
  createSubscriberGroup,
  updateSubscriberGroup,
} = require("../Controllers/subscriberGroup.controller");

/**
 * Create a new Subscriber Group
 * POST /api/subscriber-groups
 * Body: { id, name }
 */
router.post("/subscriber-groups", createSubscriberGroup);

/**
 * Update a Subscriber Group by its external id
 * PATCH /api/subscriber-groups/:id
 * Body: { name?, id? }
 */
router.patch("/subscriber-groups/:id", updateSubscriberGroup);

module.exports = router;
