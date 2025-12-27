const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  getAllUsers,
  deleteUserById,
} = require("../Controllers/adminControler");

const { adminProtect } = require("../middleware/authAdmin");

router.post("/register", registerAdmin);

router.post("/login", loginAdmin);
router.get("/profile", adminProtect, getAdminProfile);
router.get("/users", adminProtect, getAllUsers);
router.delete("/users/:id", adminProtect, deleteUserById);

module.exports = router;
