const express = require("express");
const router = express.Router();

const { getDashboardOverview } = require("../Controllers/dashboardcontroller");

router.get("/overview", getDashboardOverview);

module.exports = router;
