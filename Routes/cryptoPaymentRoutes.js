const express = require("express");
const router = express.Router();
const callbackRouter = express.Router();
const crypto = require("crypto");

const Transaction = require("../Models/TransactionModel");
const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { sendTemplate, platformUrl } = require("../services/emailservice");
const { ensureOrderBooksInLibrary } = require("../services/libraryService");
const {
  createPaymentAddress,
  generateCallbackToken,
  getSupportedCoins,
} = require("../services/blockbeeService");

const firstName = (name) =>
  String(name || "there").trim().split(/\s+/)[0] || "there";
const formatNaira = (amount) =>
  `NGN ${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const productsFor = async (order) => {
  const books = await Book.find({
    _id: { $in: order.items.map((item) => item.book) },
  })
    .select("title")
    .lean();
  const names = new Map(books.map((book) => [String(book._id), book.title]));
  return order.items
    .map((item) => names.get(String(item.book)) || "SankofaSeek material")
    .join(", ");
};

async function claimAndSend(transaction, event, kind, variables) {
  const claimed = await Transaction.updateOne(
    { _id: transaction._id, [`emailEvents.${event}`]: { $exists: false } },
    { $set: { [`emailEvents.${event}`]: new Date() } },
  );
  if (!claimed.modifiedCount) return;
  try {
    await sendTemplate(kind, variables);
  } catch {
    console.error(
      `[EMAIL][${kind}] delivery failed for transaction ${transaction._id}`,
    );
  }
}

async function sendPaymentEmails(order, transaction) {
  const libraryLink = `${platformUrl().replace(/\/$/, "")}/library`;
  const productName = await productsFor(order);
  const common = {
    to: order.userInfo.email,
    firstName: firstName(order.userInfo.name),
    productName,
    orderNumber: String(order._id),
    purchaseDate: new Date(transaction.paidAt || Date.now()).toLocaleDateString(
      "en-GB",
    ),
    amount: formatNaira(order.totalAmount),
    libraryLink,
  };
  await claimAndSend(
    transaction,
    "purchaseConfirmation",
    "purchaseConfirmation",
    common,
  );
  await claimAndSend(transaction, "libraryAccess", "libraryAccess", common);
}

/**
 * GET /api/crypto/coins
 * List coins/tokens the checkout UI can offer.
 */
router.get("/coins", async (req, res) => {
  try {
    const coins = await getSupportedCoins();
    return res.status(200).json({ success: true, data: coins });
  } catch (error) {
    console.error("CRYPTO COINS ERROR:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to load supported coins" });
  }
});

/**
 * POST /api/crypto/initialize
 * Body: { orderId, coin }
 * Creates a BlockBee deposit address for an existing order and records
 * a pending Transaction against it.
 */
router.post("/initialize", async (req, res) => {
  try {
    const { orderId, coin } = req.body;

    if (!orderId || !coin) {
      return res
        .status(400)
        .json({ success: false, error: "orderId and coin are required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
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

    const reference = `CRYPTO-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const callbackToken = generateCallbackToken();

    // Crypto settlement is priced in USD; NGN order total is only used
    // for display/receipts. A real deployment should convert via a
    // trusted FX rate here rather than sending the NGN figure to BlockBee.
    const usdValue = amount;

    const { address, coinAmount, qrCodeDataUri, fiatCurrency } =
      await createPaymentAddress({
        coin,
        fiatValue: usdValue,
        callbackToken,
      });

    order.paymentReference = reference;
    order.totalAmount = amount;
    order.paymentMethod = "crypto";
    await order.save();

    const transaction = await Transaction.create({
      order: order._id,
      reference,
      amount,
      gateway: "BlockBee",
      cryptoCoin: coin,
      cryptoAddress: address,
      cryptoCallbackToken: callbackToken,
      expectedFiatAmount: usdValue,
      expectedFiatCurrency: fiatCurrency,
      expectedCoinAmount: coinAmount || undefined,
    });

    return res.status(200).json({
      success: true,
      data: {
        reference,
        coin,
        address,
        qrCode: qrCodeDataUri,
        amount: usdValue,
        currency: fiatCurrency,
        coinAmount,
      },
    });
  } catch (error) {
    console.error("CRYPTO INIT ERROR:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Crypto payment initialization failed" });
  }
});

/**
 * GET /api/crypto/status/:reference
 * Polled by the frontend pending-payment screen.
 */
router.get("/status/:reference", async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      reference: req.params.reference,
      gateway: "BlockBee",
    });

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, error: "Transaction not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentStatus: transaction.paymentStatus,
        confirmations: transaction.confirmations || 0,
      },
    });
  } catch (error) {
    console.error("CRYPTO STATUS ERROR:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch payment status" });
  }
});

/**
 * POST /api/crypto/cancel/:reference
 * Lets the user abandon a pending crypto payment from the checkout UI.
 * No-ops (rather than erroring) if the payment already confirmed, since
 * a stale client shouldn't be able to un-pay a completed order.
 */
router.post("/cancel/:reference", async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      reference: req.params.reference,
      gateway: "BlockBee",
    }).populate("order");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, error: "Transaction not found" });
    }

    if (transaction.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: transaction.paymentStatus },
      });
    }

    transaction.paymentStatus = "Cancelled";
    await transaction.save();

    if (transaction.order) {
      await Order.updateOne(
        { _id: transaction.order._id, paymentStatus: { $ne: "Paid" } },
        {
          $set: {
            paymentStatus: "Cancelled",
            status: "Cancelled",
          },
        },
      );
    }

    return res.status(200).json({
      success: true,
      data: { paymentStatus: "Cancelled" },
    });
  } catch (error) {
    console.error("CRYPTO CANCEL ERROR:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to cancel payment" });
  }
});

/**
 * GET|POST /api/crypto/callback/:callbackToken
 * BlockBee IPN. The unguessable per-transaction callbackToken (not the
 * request body) is what authenticates this call — BlockBee does not sign
 * callbacks, so anyone who doesn't know the token cannot forge a payment.
 * BlockBee retries until it gets an HTTP 200 with body "*ok*".
 */
callbackRouter.all("/:callbackToken", async (req, res) => {
  const ackOk = () => res.status(200).send("*ok*");

  try {
    const { callbackToken } = req.params;
    const payload = { ...req.query, ...req.body };

    const transaction = await Transaction.findOne({
      cryptoCallbackToken: callbackToken,
      gateway: "BlockBee",
    }).populate("order");

    if (!transaction) {
      // Unknown token: acknowledge so BlockBee stops retrying, but do
      // nothing — this is not a valid payment for us.
      return ackOk();
    }

    if (transaction.paymentStatus === "Paid") {
      return ackOk();
    }

    const confirmations = Number(payload.confirmations || 0);
    const result = String(payload.result || "").toLowerCase();
    const receivedValue = Number(payload.value_coin_convert || payload.value || 0);
    const isPending = String(payload.pending || "0") === "1";

    transaction.confirmations = confirmations;
    transaction.gatewayResponse = payload;

    // BlockBee sends interim "pending" callbacks before the payment is
    // fully confirmed on-chain; only finalize on a confirmed, non-pending,
    // successfully-received notification.
    if (isPending || result !== "sent" || confirmations < 1) {
      await transaction.save();
      return ackOk();
    }

    const expected = Number(transaction.expectedFiatAmount || 0);
    if (expected > 0 && receivedValue > 0 && receivedValue < expected * 0.98) {
      // Underpaid by more than a 2% tolerance (covers price/fee slippage).
      console.error("[CRYPTO][CALLBACK][UNDERPAID]", {
        reference: transaction.reference,
        expected,
        received: receivedValue,
      });
      transaction.paymentStatus = "Failed";
      await transaction.save();
      return ackOk();
    }

    const paidAt = new Date();
    transaction.paymentStatus = "Paid";
    transaction.paidAt = paidAt;
    transaction.confirmedTxHash = payload.txid_in || payload.txid || undefined;
    await transaction.save();

    const order = transaction.order;
    const orderUpdate = await Order.updateOne(
      { _id: order._id, paymentStatus: { $ne: "Paid" } },
      {
        $set: {
          paymentStatus: "Paid",
          status: "Completed",
          paymentReference: transaction.reference,
          paidAt,
        },
      },
    );

    if (orderUpdate.modifiedCount) {
      order.paymentStatus = "Paid";
      order.status = "Completed";
      order.paidAt = paidAt;

      for (const item of order.items) {
        await Book.findByIdAndUpdate(item.book, {
          $inc: { stockQuantity: -item.quantity },
        });
      }

      await ensureOrderBooksInLibrary({ order, transaction });
      await sendPaymentEmails(order, transaction);
    }

    return ackOk();
  } catch (error) {
    console.error("CRYPTO CALLBACK ERROR:", error);
    // Still ack so BlockBee doesn't hammer us with retries for a bug on
    // our side; the transaction stays "Pending" and can be reconciled
    // manually via BlockBee's logs endpoint if needed.
    return ackOk();
  }
});

module.exports = { router, callbackRouter };
