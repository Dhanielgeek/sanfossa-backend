const Order = require("../Models/BooksOrdersModel");
const { verifyPayment } = require("../services/paystackservice");
const Book = require("../Models/BooksModel");
const { sendEmail } = require("../services/emailservice");
const Libary = require("../Models/LibraryModel");
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

    // Add purchased books to user's library
    const libraryEntries = order.items.map((item) => ({
      email: order.userInfo.email,
      book: item.book,
      order: order._id,
      paymentReference: reference,
    }));

    await Libary.insertMany(libraryEntries, { ordered: false });

    // Fetch purchased books
    const books = await Book.find({
      _id: { $in: order.items.map((item) => item.book) },
    });

    // Build attachments (PDFs)
    const attachments = books
      .filter((book) => book.pdfFile) // ensure PDF exists
      .map((book) => ({
        filename: `${book.title}.pdf`,
        path: book.pdfFile, // Cloudinary URL
      }));

    // Receipt HTML (simple version)
    const receiptHtml = `
  <h2>Payment Receipt</h2>
  <p>Hi ${order.userInfo.name},</p>
  <p>Your payment was successful.</p>

  <h3>Order Details:</h3>
  <ul>
    ${order.items
      .map(
        (item) => `
      <li>${item.title} x ${item.quantity} - ₦${item.priceAtPurchase}</li>
    `,
      )
      .join("")}
  </ul>

  <p><strong>Total:</strong> ₦${order.totalAmount}</p>

  <p>Thank you for your purchase 🎉</p>
`;

    // Send email
    await sendEmail({
      to: order.userInfo.email,
      subject: "Your Purchase Receipt & Books",
      html: receiptHtml,
      attachments,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: order,
    });

    console.log("ORDER FOUND:", order);
    console.log("EMAIL:", order.userInfo.email);
  } catch (error) {
    console.error("PAYMENT VERIFICATION ERROR:", error.message);

    return res.status(500).json({
      success: false,
      error: "Payment verification failed",
    });
  }
};
