const express = require("express");
const router = express.Router();
const {
  getAdminDashboard,
} = require("../Controllers/adminDashboardController");
const { adminProtect } = require("../middleware/authAdmin");

router.get("/dashboard", adminProtect, getAdminDashboard);

module.exports = router;
