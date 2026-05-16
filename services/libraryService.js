const Library = require("../Models/LibraryModel");
const Book = require("../Models/BooksModel");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const buildBookSnapshot = (book) => ({
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
});

async function pushLibraryBook({ email, userId, entry }) {
  const normalizedEmail = normalizeEmail(email);

  const update = {
    $setOnInsert: {
      email: normalizedEmail,
      schemaVersion: 2,
      ...(userId ? { userId } : {}),
    },
    $set: {
      updatedAt: new Date(),
      ...(userId ? { userId } : {}),
    },
    $push: { books: entry },
  };

  const filter = {
    email: normalizedEmail,
    schemaVersion: 2,
    books: {
      $not: {
        $elemMatch: {
          bookId: entry.bookId,
          orderId: entry.orderId,
          paymentReference: entry.paymentReference,
        },
      },
    },
  };

  try {
    const result = await Library.updateOne(filter, update, { upsert: true });
    return Boolean(result.upsertedCount || result.modifiedCount);
  } catch (error) {
    if (error.code !== 11000) throw error;

    const retryResult = await Library.updateOne(filter, {
      $set: {
        updatedAt: new Date(),
        ...(userId ? { userId } : {}),
      },
      $push: { books: entry },
    });

    return Boolean(retryResult.modifiedCount);
  }
}

exports.ensureOrderBooksInLibrary = async ({ order, transaction }) => {
  if (!order || !transaction) {
    throw new Error("Order and transaction are required for library persistence");
  }

  if (order.paymentStatus !== "Paid" || transaction.paymentStatus !== "Paid") {
    throw new Error("Cannot persist library for unpaid order or transaction");
  }

  const email = normalizeEmail(order.userInfo && order.userInfo.email);
  if (!email) throw new Error("Order email is required for library persistence");

  const bookIds = order.items.map((item) => item.book);
  const books = await Book.find({ _id: { $in: bookIds } });
  const booksById = new Map(books.map((book) => [String(book._id), book]));

  const results = [];

  for (const item of order.items) {
    const book = booksById.get(String(item.book));
    if (!book) {
      results.push({
        bookId: item.book,
        added: false,
        skipped: true,
        reason: "Book not found",
      });
      continue;
    }

    const entry = {
      bookId: book._id,
      orderId: order._id,
      transactionId: transaction._id,
      paymentReference: transaction.reference,
      purchasedAt: transaction.paidAt || order.paidAt || new Date(),
      bookSnapshot: buildBookSnapshot(book),
    };

    const added = await pushLibraryBook({
      email,
      userId: order.user,
      entry,
    });

    results.push({
      bookId: book._id,
      added,
      skipped: !added,
    });
  }

  return {
    email,
    attempted: results.length,
    added: results.filter((result) => result.added).length,
    results,
  };
};
