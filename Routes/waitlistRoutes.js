const express = require("express");
const router = express.Router();

const { joinWaitlist } = require("../Controllers/waitlistController");

router.post("/", joinWaitlist);

module.exports = router;
