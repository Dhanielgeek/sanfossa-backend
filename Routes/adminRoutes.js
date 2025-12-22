const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
} = require("../Controllers/adminControler");

const { adminProtect } = require("../middleware/adminauth");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/profile", adminProtect, getAdminProfile);

module.exports = router;
