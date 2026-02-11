const Transaction = require("../Models/TransactionModel");
const Order = require("../Models/BooksOrdersModel");
const { initializePayment } = require("../services/paystackservice");

exports.initializeTransaction = async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order)
      return res.status(404).json({ success: false, error: "Order not found" });

    if (order.paymentStatus === "Paid")
      return res
        .status(400)
        .json({ success: false, error: "Order already paid" });

    // 🔥 Calculate amount dynamically
    const amount = order.items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const reference = `ORD-${Date.now()}-${require("crypto").randomBytes(4).toString("hex")}`;

    const paystackResponse = await initializePayment({
      email: order.userInfo.email,
      amount: amount * 100, // kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${reference}`,
    });

    const transaction = await Transaction.create({
      order: order._id,
      reference,
      amount, // optional — you can keep or remove this
      authorization_url: paystackResponse.data.authorization_url,
    });

    return res.status(200).json({
      success: true,
      data: {
        reference,
        authorization_url: transaction.authorization_url,
      },
    });
  } catch (error) {
    console.error("INIT TRANSACTION ERROR:", error.message);
    return res.status(500).json({
      success: false,
      error: "Payment initialization failed",
    });
  }
};
