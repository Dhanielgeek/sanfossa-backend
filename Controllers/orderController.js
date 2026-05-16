const Order = require("../Models/BooksOrdersModel");
const Book = require("../Models/BooksModel");

exports.createOrder = async (req, res) => {
  const { items, userInfo } = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({ success: false, error: "No items provided" });

  if (
    !userInfo?.name ||
    !userInfo?.email ||
    !userInfo?.phone ||
    !userInfo?.address
  )
    return res
      .status(400)
      .json({ success: false, error: "Incomplete user info" });

  try {
    const bookIds = items.map((item) => item.book);
    const books = await Book.find({ _id: { $in: bookIds }, status: "published" });
    const booksById = new Map(books.map((book) => [String(book._id), book]));

    const normalizedItems = items.map((item) => {
      const book = booksById.get(String(item.book));
      const quantity = Number(item.quantity);

      if (!book) {
        throw new Error(`Book not found or unavailable: ${item.book}`);
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Invalid item quantity");
      }

      return {
        book: book._id,
        quantity,
        priceAtPurchase: book.price,
      };
    });

    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.priceAtPurchase * item.quantity,
      0,
    );

    const order = await Order.create({
      items: normalizedItems,
      userInfo: {
        ...userInfo,
        email: userInfo.email.toLowerCase().trim(),
      },
      totalAmount,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error.message);
    return res.status(error.message.includes("Book") || error.message.includes("quantity") ? 400 : 500).json({
      success: false,
      error:
        error.message.includes("Book") || error.message.includes("quantity")
          ? error.message
          : "Server error while creating order",
    });
  }
};
