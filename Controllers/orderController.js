const mongoose = require("mongoose");
const crypto = require("crypto");

const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");
const { initializePayment } = require("../services/paystackservice");

exports.createOrder = async (req, res) => {
  const { items, userInfo } = req.body;

  // ---- Validation ----
  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: "No items provided",
    });
  }

  if (
    !userInfo?.name ||
    !userInfo?.email ||
    !userInfo?.phone ||
    !userInfo?.address
  ) {
    return res.status(400).json({
      success: false,
      error: "Incomplete user info",
    });
  }

  // ---- Generate payment reference ----
  const reference = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let totalAmount = 0;

    // ---- Stock validation & deduction ----
    for (const item of items) {
      const book = await Book.findById(item.book).session(session);

      if (!book) throw new Error(`Book not found`);
      if (book.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${book.title}`);
      }

      // Deduct stock
      await Book.findByIdAndUpdate(
        item.book,
        { $inc: { stockQuantity: -item.quantity } },
        { session },
      );

      totalAmount += item.priceAtPurchase * item.quantity;
    }

    // ---- Create order ----
    const order = await Order.create(
      [
        {
          items,
          userInfo,
          totalAmount,
          paymentStatus: "Pending",
          paymentReference: reference,
        },
      ],
      { session },
    );

    // ---- Initialize Paystack ----
    const paystackResponse = await initializePayment({
      email: userInfo.email,
      amount: totalAmount * 100, // kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${reference}`,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order[0]._id,
        reference,
        authorization_url: paystackResponse?.data?.authorization_url,
        totalAmount,
        paymentStatus: "Pending",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("CREATE ORDER ERROR:", error.message);

    return res.status(500).json({
      success: false,
      error: error.message || "Server error while creating order",
    });
  }
};
