const Order = require("../Models/BooksOrdersModel");
const { verifyPayment } = require("../services/paystackservice");
const Book = require("../Models/BooksModel");
const { sendEmail } = require("../services/emailservice");
const Library = require("../Models/LibraryModel");

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
    // =========================================
    // VERIFY PAYMENT FROM PAYSTACK
    // =========================================
    const paystackResponse = await verifyPayment(reference);

    if (!paystackResponse || paystackResponse.data.status !== "success") {
      return res.status(400).json({
        success: false,
        error: "Payment not successful",
      });
    }

    // =========================================
    // FIND ORDER
    // =========================================
    const order = await Order.findOne({
      paymentReference: reference,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // =========================================
    // CHECK IF LIBRARY ALREADY EXISTS
    // =========================================
    const existingLibrary = await Library.findOne({
      email: order.userInfo.email,
      paymentReference: reference,
    });

    // If already verified AND library already exists
    if (order.paymentStatus === "Paid" && existingLibrary) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified and library exists",
        data: order,
      });
    }

    // If payment already verified but library missing
    if (order.paymentStatus === "Paid" && !existingLibrary) {
      console.log("🔥 PAYMENT EXISTS BUT LIBRARY MISSING");
    }

    // =========================================
    // MARK ORDER AS PAID
    // =========================================
    order.paymentStatus = "Paid";
    order.paidAt = new Date();

    await order.save();

    // =========================================
    // FETCH BOOKS
    // =========================================
    const books = await Book.find({
      _id: {
        $in: order.items.map((item) => item.book),
      },
    });

    // =========================================
    // CREATE LIBRARY ENTRIES
    // =========================================
    const libraryEntries = books.map((book) => ({
      email: order.userInfo.email,

      order: order._id,

      paymentReference: reference,

      purchasedAt: new Date(),

      bookSnapshot: {
        bookId: book._id,

        title: book.title,
        subtitle: book.subtitle,
        summary: book.summary,
        content: book.content,

        author: book.author,
        narrator: book.narrator,

        category: book.category,

        coverImage: book.coverImage,
        pdfFile: book.pdfFile,

        readingTime: book.readingTime,
        ageRating: book.ageRating,

        price: book.price,

        tags: book.tags,
      },
    }));

    console.log("🔥 LIBRARY ENTRIES:", libraryEntries);

    // =========================================
    // SAVE INTO LIBRARY
    // =========================================
    // =========================================
    // CREATE LIBRARY IF MISSING
    // =========================================

    if (!existingLibrary) {
      const books = await Book.find({
        _id: {
          $in: order.items.map((item) => item.book),
        },
      });

      const libraryEntries = books.map((book) => ({
        email: order.userInfo.email.toLowerCase(),

        order: order._id,

        paymentReference: reference,

        purchasedAt: new Date(),

        bookSnapshot: {
          bookId: book._id,

          title: book.title,
          subtitle: book.subtitle,
          summary: book.summary,
          content: book.content,

          author: book.author,
          narrator: book.narrator,

          category: book.category,

          coverImage: book.coverImage,
          pdfFile: book.pdfFile,

          readingTime: book.readingTime,
          ageRating: book.ageRating,

          price: book.price,

          tags: book.tags,
        },
      }));

      console.log("🔥 SAVING LIBRARY:", libraryEntries);

      await Library.insertMany(libraryEntries);

      console.log("✅ LIBRARY SAVED");
    }

    // =========================================
    // EMAIL ATTACHMENTS
    // =========================================
    const attachments = books
      .filter((book) => book.pdfFile)
      .map((book) => ({
        filename: `${book.title}.pdf`,
        path: book.pdfFile,
      }));

    // =========================================
    // RECEIPT HTML
    // =========================================
    const receiptHtml = `
      <h2>Payment Receipt</h2>

      <p>Hi ${order.userInfo.name},</p>

      <p>Your payment was successful.</p>

      <h3>Order Details:</h3>

      <ul>
        ${order.items
          .map(
            (item) => `
              <li>
                ${item.quantity} x ₦${item.priceAtPurchase}
              </li>
            `,
          )
          .join("")}
      </ul>

      <p>
        <strong>Total:</strong> ₦${order.totalAmount}
      </p>

      <p>Thank you for your purchase 🎉</p>
    `;

    // =========================================
    // SEND EMAIL
    // =========================================
    await sendEmail({
      to: order.userInfo.email,
      subject: "Your Purchase Receipt & Books",
      html: receiptHtml,
      attachments,
    });

    // =========================================
    // SUCCESS RESPONSE
    // =========================================
    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        order,
        libraryCreated: true,
      },
    });
  } catch (error) {
    console.error("PAYMENT VERIFICATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Payment verification failed",
    });
  }
};
