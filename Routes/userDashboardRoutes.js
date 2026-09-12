const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

const { getDashboardOverview } = require("../Controllers/dashboardcontroller");

router.get("/overview", protect, getDashboardOverview);

module.exports = router;
