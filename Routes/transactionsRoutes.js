const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Transaction = require("../Models/TransactionModel");
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { ensureOrderBooksInLibrary } = require("../services/libraryService");
const {
  initializePayment,
  verifyPayment,
} = require("../services/paystackservice");

/**
 * POST /api/transactions/initialize
 * Initialize Paystack payment for an existing order.
 */
router.post("/initialize", async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.paymentStatus === "Paid") {
      return res
        .status(400)
        .json({ success: false, error: "Order already paid" });
    }

    const amount = order.items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const reference = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const paystackResponse = await initializePayment({
      email: order.userInfo.email,
      amount: amount * 100,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/verify/`,
    });

    order.paymentReference = reference;
    order.totalAmount = amount;
    await order.save();

    console.log("[TRANSACTION][INITIALIZE] order:", {
      orderId: String(order._id),
      user: order.user ? String(order.user) : null,
      email: order.userInfo.email,
      amount,
      reference,
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
 * GET /api/transactions/verify/:reference
 * Verify Paystack payment and persist purchased books to library.
 */
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const transaction = await Transaction.findOne({ reference }).populate(
      "order",
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    console.log("[TRANSACTION][VERIFY] loaded:", {
      reference,
      transactionId: String(transaction._id),
      transactionStatus: transaction.paymentStatus,
      orderId: transaction.order && transaction.order._id
        ? String(transaction.order._id)
        : null,
      orderUser: transaction.order && transaction.order.user
        ? String(transaction.order.user)
        : null,
      orderStatus: transaction.order ? transaction.order.paymentStatus : null,
      orderEmail: transaction.order ? transaction.order.userInfo.email : null,
    });

    if (transaction.paymentStatus === "Paid") {
      await Order.updateOne(
        { _id: transaction.order._id, paymentStatus: { $ne: "Paid" } },
        {
          $set: {
            paymentStatus: "Paid",
            status: "Completed",
            paymentReference: reference,
            paidAt: transaction.paidAt || new Date(),
          },
        },
      );
      transaction.order.paymentStatus = "Paid";
      transaction.order.status = "Completed";
      transaction.order.paymentReference = reference;
      transaction.order.paidAt = transaction.paidAt || new Date();

      const library = await ensureOrderBooksInLibrary({
        order: transaction.order,
        transaction,
      });

      return res.status(200).json({
        success: true,
        message: "Transaction already verified",
        data: { library },
      });
    }

    const paystackResponse = await verifyPayment(reference);
    const paymentData = paystackResponse && paystackResponse.data;
    const expectedAmount = Math.round(transaction.amount * 100);

    console.log("[TRANSACTION][VERIFY] paystack:", {
      reference,
      status: paymentData && paymentData.status,
      amount: paymentData && paymentData.amount,
      expectedAmount,
      currency: paymentData && paymentData.currency,
    });

    if (
      !paymentData ||
      paymentData.status !== "success" ||
      paymentData.reference !== reference ||
      paymentData.amount !== expectedAmount ||
      paymentData.currency !== "NGN"
    ) {
      transaction.paymentStatus = "Failed";
      transaction.gatewayResponse = paymentData || paystackResponse;
      await transaction.save();

      return res.status(400).json({
        success: false,
        error: "Payment verification mismatch or payment not successful",
      });
    }

    const paidAt = new Date();
    const paidTransaction = await Transaction.findOneAndUpdate(
      { _id: transaction._id, paymentStatus: { $ne: "Paid" } },
      {
        $set: {
          paymentStatus: "Paid",
          paidAt,
          gatewayResponse: paymentData,
        },
      },
      { new: true },
    ).populate("order");

    if (!paidTransaction) {
      const currentTransaction = await Transaction.findById(
        transaction._id,
      ).populate("order");
      await Order.updateOne(
        { _id: currentTransaction.order._id, paymentStatus: { $ne: "Paid" } },
        {
          $set: {
            paymentStatus: "Paid",
            status: "Completed",
            paymentReference: reference,
            paidAt: currentTransaction.paidAt || new Date(),
          },
        },
      );
      currentTransaction.order.paymentStatus = "Paid";
      currentTransaction.order.status = "Completed";
      currentTransaction.order.paymentReference = reference;
      currentTransaction.order.paidAt = currentTransaction.paidAt || new Date();

      const library = await ensureOrderBooksInLibrary({
        order: currentTransaction.order,
        transaction: currentTransaction,
      });

      return res.status(200).json({
        success: true,
        message: "Transaction already verified",
        data: { library },
      });
    }

    const order = paidTransaction.order;
    const orderUpdate = await Order.updateOne(
      { _id: order._id, paymentStatus: { $ne: "Paid" } },
      {
        $set: {
          paymentStatus: "Paid",
          status: "Completed",
          paymentReference: reference,
          paidAt: paidTransaction.paidAt,
        },
      },
    );

    order.paymentStatus = "Paid";
    order.status = "Completed";
    order.paymentReference = reference;
    order.paidAt = paidTransaction.paidAt;

    console.log("[TRANSACTION][VERIFY] paid order:", {
      orderId: String(order._id),
      user: order.user ? String(order.user) : null,
      paymentStatus: order.paymentStatus,
      status: order.status,
      reference,
    });

    if (orderUpdate.modifiedCount) {
      for (const item of order.items) {
        await Book.findByIdAndUpdate(item.book, {
          $inc: { stockQuantity: -item.quantity },
        });
      }
    }

    const library = await ensureOrderBooksInLibrary({
      order,
      transaction: paidTransaction,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and order updated",
      data: { library },
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
