const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  getAllUsers,
  deleteUserById,
  refreshAdminSession,
} = require("../Controllers/adminControler");
const { getWaitlistEntries } = require("../Controllers/waitlistController");

const { adminProtect } = require("../middleware/authAdmin");

// Only an existing admin can create another admin account.
router.post("/register", adminProtect, registerAdmin);
router.post("/login", loginAdmin);
router.post("/refresh", adminProtect, refreshAdminSession);
router.get("/profile", adminProtect, getAdminProfile);
router.get("/me", adminProtect, getAdminProfile);
router.put("/updateprofile", adminProtect, updateAdminProfile);
router.get("/users", adminProtect, getAllUsers);
router.get("/waitlist", adminProtect, getWaitlistEntries);
router.delete("/users/:id", adminProtect, deleteUserById);

module.exports = router;
