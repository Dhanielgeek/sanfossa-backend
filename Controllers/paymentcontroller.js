const Order = require("../Models/BooksOrdersModel");
const { verifyPayment } = require("../services/paystackservice");

/**
 * -----------------------------------
 * GET /api/v1/payments/verify/:reference
 * Verify Paystack payment & update order
 * -----------------------------------
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
    // ---- Verify payment with Paystack ----
    const paystackResponse = await verifyPayment(reference);

    if (!paystackResponse || paystackResponse.data.status !== "success") {
      return res.status(400).json({
        success: false,
        error: "Payment not successful",
      });
    }

    // ---- Find order by reference ----
    const order = await Order.findOne({ paymentReference: reference });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // ---- Prevent double processing ----
    if (order.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: order,
      });
    }

    // ---- Mark order as paid ----
    order.paymentStatus = "Paid";
    order.paidAt = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: order,
    });
  } catch (error) {
    console.error("PAYMENT VERIFICATION ERROR:", error.message);

    return res.status(500).json({
      success: false,
      error: "Payment verification failed",
    });
  }
};
