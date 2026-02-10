const express = require("express");
const router = express.Router();
const { verifyPaystackPayment } = require("../Controllers/paymentcontroller");

router.get("/verify/:reference", verifyPaystackPayment);

module.exports = router;
