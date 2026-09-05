const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Transaction = require("../Models/TransactionModel");
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { sendTemplate, platformUrl } = require("../services/emailservice");
const { ensureOrderBooksInLibrary } = require("../services/libraryService");
const {
  initializePayment,
  verifyPayment,
} = require("../services/paystackservice");

const firstName = (name) => String(name || "there").trim().split(/\s+/)[0] || "there";
const formatNaira = (amount) => `NGN ${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const productsFor = async (order) => {
  const books = await Book.find({ _id: { $in: order.items.map((item) => item.book) } }).select("title").lean();
  const names = new Map(books.map((book) => [String(book._id), book.title]));
  return order.items.map((item) => names.get(String(item.book)) || "SankofaSeek material").join(", ");
};
async function claimAndSend(transaction, event, kind, variables) {
  const claimed = await Transaction.updateOne({ _id: transaction._id, [`emailEvents.${event}`]: { $exists: false } }, { $set: { [`emailEvents.${event}`]: new Date() } });
  if (!claimed.modifiedCount) return;
  try { await sendTemplate(kind, variables); } catch { console.error(`[EMAIL][${kind}] delivery failed for transaction ${transaction._id}`); }
}
async function sendPaymentEmails(order, transaction) {
  const libraryLink = `${platformUrl().replace(/\/$/, "")}/library`;
  const productName = await productsFor(order);
  const common = { to: order.userInfo.email, firstName: firstName(order.userInfo.name), productName, orderNumber: String(order._id), purchaseDate: new Date(transaction.paidAt || Date.now()).toLocaleDateString("en-GB"), amount: formatNaira(order.totalAmount), libraryLink };
  await claimAndSend(transaction, "purchaseConfirmation", "purchaseConfirmation", common);
  await claimAndSend(transaction, "libraryAccess", "libraryAccess", common);
}
async function sendPaymentFailureEmail(order, transaction) {
  const productName = await productsFor(order);
  await claimAndSend(transaction, "paymentFailed", "paymentFailed", { to: order.userInfo.email, firstName: firstName(order.userInfo.name), productName, orderNumber: String(order._id), amount: formatNaira(order.totalAmount), paymentDate: new Date().toLocaleDateString("en-GB"), paymentLink: `${platformUrl().replace(/\/$/, "")}/checkout?orderId=${encodeURIComponent(String(order._id))}` });
}

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


    console.log(
    "🔥🔥🔥 VERIFY ROUTE HIT 🔥🔥🔥",
    req.params.reference
  );
  try {
    const { reference } = req.params;

      console.log(
      "[TRANSACTION][VERIFY][START]",
      reference
    );

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
      await sendPaymentEmails(transaction.order, transaction);

      return res.status(200).json({
        success: true,
        message: "Transaction already verified",
        data: { library },
      });
    }

    const paystackResponse = await verifyPayment(reference);

    console.log(
  "[TRANSACTION][VERIFY][RAW PAYSTACK RESPONSE]",
  JSON.stringify(paystackResponse, null, 2)
);
    const paymentData = paystackResponse && paystackResponse.data;
    const expectedAmount = Math.round(transaction.amount * 100);

    console.log("[TRANSACTION][VERIFY] paystack:", {
      reference,
      status: paymentData && paymentData.status,
      amount: paymentData && paymentData.amount,
      expectedAmount,
      currency: paymentData && paymentData.currency,
    });

   const verificationChecks = {
  hasPaymentData: !!paymentData,
  paystackStatus: paymentData?.status,
  expectedStatus: "success",

  paystackReference: paymentData?.reference,
  expectedReference: reference,

  paystackAmount: paymentData?.amount,
  expectedAmount,

  paystackCurrency: paymentData?.currency,
  expectedCurrency: "NGN",
};

console.log("[TRANSACTION][VERIFY][CHECKS]", verificationChecks);

const isValidPayment =
  paymentData &&
  paymentData.status === "success" &&
  String(paymentData.reference) === String(reference) &&
  Number(paymentData.amount) === Number(expectedAmount) &&
  String(paymentData.currency).toUpperCase() === "NGN";

if (!isValidPayment) {
  console.error(
    "[TRANSACTION][VERIFY][MISMATCH]",
    verificationChecks
  );

  transaction.paymentStatus = "Failed";
  transaction.gatewayResponse = paymentData || paystackResponse;

  await transaction.save();

  await sendPaymentFailureEmail(transaction.order, transaction);

  return res.status(400).json({
    success: false,
    error: "Payment verification mismatch or payment not successful",
    details: {
      paystackStatus: paymentData?.status,
      paystackReference: paymentData?.reference,
      expectedReference: reference,
      paystackAmount: paymentData?.amount,
      expectedAmount,
      paystackCurrency: paymentData?.currency,
    },
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
      await sendPaymentEmails(currentTransaction.order, currentTransaction);

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
    await sendPaymentEmails(order, paidTransaction);

    return res.status(200).json({
      success: true,
      message: "Payment verified and order updated",
      data: { library },
    });
  }  catch (error) {
  console.error("========================================");
  console.error("🔥 [TRANSACTION][VERIFY][ERROR] 🔥");
  console.error("Message:", error?.message);
  console.error("Stack:", error?.stack);

  if (error?.response) {
    console.error(
      "[TRANSACTION][VERIFY][PAYSTACK ERROR]",
      {
        status: error.response.status,
        data: error.response.data,
      }
    );
  }

  console.error("========================================");

  return res.status(500).json({
    success: false,
    error: "Verification failed",
    debug: error?.message || "Unknown verification error",
  });
}
});

module.exports = router;
