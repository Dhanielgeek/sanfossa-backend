const mongoose = require("mongoose");
const crypto = require("crypto");

const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { initializePayment } = require("../services/paystackservice");

/**
 * POST /api/v1/orders
 * Guest checkout + Paystack init
 */
exports.createOrder = async (req, res) => {
  const { items, userInfo } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: "No items provided" });
  }

  if (
    !userInfo ||
    !userInfo.name ||
    !userInfo.email ||
    !userInfo.phone ||
    !userInfo.address
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Incomplete user info" });
  }

  const reference = crypto.randomUUID();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ---- Stock check & decrement ----
    for (const item of items) {
      const book = await Book.findById(item.book).session(session);
      if (!book) throw new Error(`Book not found: ${item.book}`);
      if (book.stockQuantity < item.quantity)
        throw new Error(`Insufficient stock for: ${book.title}`);

      await Book.findByIdAndUpdate(
        item.book,
        { $inc: { stockQuantity: -item.quantity } },
        { session },
      );
    }

    // ---- Create order (payment pending) ----
    const order = new Order({
      items,
      userInfo,
      paymentStatus: "Pending",
      paymentReference: reference,
    });

    await order.save({ session });

    // ---- Calculate total for Paystack ----
    const amount = items.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    // ---- Initialize Paystack ----
    const paystackResponse = await initializePayment({
      email: userInfo.email,
      amount, // amount in Naira → paystack expects kobo, your service should multiply by 100 if needed
      reference,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order created. Proceed to payment.",
      data: {
        orderId: order._id,
        reference,
        authorization_url: paystackResponse.data.authorization_url,
        userInfo,
        items,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({ success: false, error: error.message });
  }
};
