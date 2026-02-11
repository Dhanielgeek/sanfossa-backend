const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Transaction = require("../Models/TransactionModel");
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const {
  initializePayment,
  verifyPayment,
} = require("../services/paystackservice");

/**
 * -----------------------------------
 * POST /api/v1/transactions/initialize
 * Initialize Paystack Payment
 * -----------------------------------
 */
router.post("/initialize", async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order)
      return res.status(404).json({ success: false, error: "Order not found" });

    if (order.paymentStatus === "Paid")
      return res
        .status(400)
        .json({ success: false, error: "Order already paid" });

    const amount = order.items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const reference = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const paystackResponse = await initializePayment({
      email: order.userInfo.email,
      amount: amount * 100,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${reference}`,
    });

    await Transaction.create({
      order: order._id,
      reference,
      amount,
      authorization_url: paystackResponse.data.authorization_url,
    });

    return res.status(200).json({
      success: true,
      data: {
        reference,
        authorization_url: paystackResponse.data.authorization_url,
      },
    });
  } catch (error) {
    console.error("INIT TRANSACTION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Payment initialization failed",
    });
  }
});

/**
 * -----------------------------------
 * GET /api/v1/transactions/verify/:reference
 * Verify Paystack Payment
 * -----------------------------------
 */
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const transaction = await Transaction.findOne({ reference }).populate(
      "order",
    );

    if (!transaction)
      return res
        .status(404)
        .json({ success: false, error: "Transaction not found" });

    const paystackResponse = await verifyPayment(reference);

    if (paystackResponse.data.status !== "success") {
      transaction.paymentStatus = "Failed";
      await transaction.save();

      return res.status(400).json({
        success: false,
        error: "Payment not successful",
      });
    }

    // ✅ Mark transaction as paid
    transaction.paymentStatus = "Paid";
    transaction.paidAt = new Date();
    transaction.gatewayResponse = paystackResponse.data;
    await transaction.save();

    // ✅ Update order
    const order = transaction.order;
    order.paymentStatus = "Paid";
    await order.save();

    // ✅ Deduct stock AFTER payment success
    for (const item of order.items) {
      await Book.findByIdAndUpdate(item.book, {
        $inc: { stockQuantity: -item.quantity },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("VERIFY ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Verification failed",
    });
  }
});

module.exports = router;
