const Order = require("../Models/BooksOrdersModel");
const Transaction = require("../Models/TransactionModel");
const { verifyPayment } = require("../services/paystackservice");
const { sendEmail } = require("../services/emailservice");
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

    const library = await ensureOrderBooksInLibrary({
      order,
      transaction: paidTransaction,
    });

    await sendEmail({
      to: order.userInfo.email,
      subject: "Your Purchase Receipt",
      html: `
        <h2>Payment Receipt</h2>
        <p>Hi ${order.userInfo.name},</p>
        <p>Your payment was successful.</p>
        <p><strong>Total:</strong> NGN ${order.totalAmount}</p>
        <p>Thank you for your purchase.</p>
      `,
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
