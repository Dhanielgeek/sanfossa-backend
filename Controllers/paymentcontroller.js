const Order = require("../Models/BooksOrdersModel");
const Transaction = require("../Models/TransactionModel");
const { verifyPayment } = require("../services/paystackservice");
const { ensureOrderBooksInLibrary } = require("../services/libraryService");

/**
 * GET /api/payments/verify/:reference
 * Verify Paystack payment, update order/transaction, and persist library.
 *
 * This controller is not mounted in index.js today, but it shares the same
 * safety rules as /api/transactions/verify/:reference if it is wired later.
 */
exports.verifyPaystackPayment = async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({
      success: false,
      error: "Payment reference is required",
    });
  }

  try {
    const transaction = await Transaction.findOne({ reference }).populate(
      "order",
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    console.log("[PAYMENT][VERIFY] loaded:", {
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
        message: "Payment already verified",
        data: { order: transaction.order, library },
      });
    }

    const paystackResponse = await verifyPayment(reference);
    const paymentData = paystackResponse && paystackResponse.data;
    const expectedAmount = Math.round(transaction.amount * 100);

    console.log("[PAYMENT][VERIFY] paystack:", {
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
        message: "Payment already verified",
        data: { order: currentTransaction.order, library },
      });
    }

    const order = paidTransaction.order;
    await Order.updateOne(
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

    console.log("[PAYMENT][VERIFY] paid order:", {
      orderId: String(order._id),
      user: order.user ? String(order.user) : null,
      paymentStatus: order.paymentStatus,
      status: order.status,
      reference,
    });

    const library = await ensureOrderBooksInLibrary({
      order,
      transaction: paidTransaction,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: { order, library },
    });
  } catch (error) {
    console.error("PAYMENT VERIFICATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Payment verification failed",
    });
  }
};
