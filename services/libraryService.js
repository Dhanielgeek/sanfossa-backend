const Library = require("../Models/LibraryModel");
const Book = require("../Models/BooksModel");

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

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
    /*
     * IMPORTANT:
     * userId is only updated with $set.
     * It must NOT appear in both $set and $setOnInsert.
     */
    const update = {
      $set: {
        updatedAt: new Date(),
        ...(userId ? { userId } : {}),
      },

      $setOnInsert: {
        email: normalizedEmail,
        schemaVersion: 2,
      },

      $push: {
        books: entry,
      },
    };

    const result = await Library.updateOne(filter, update, {
      upsert: true,
    });

    return Boolean(
      result.upsertedCount || result.modifiedCount
    );
  } catch (error) {
    /*
     * Another request may have created the library
     * between the find/update operations.
     *
     * Retry without upsert.
     */
    if (error.code !== 11000) {
      throw error;
    }

    const retryResult = await Library.updateOne(
      filter,
      {
        $set: {
          updatedAt: new Date(),
          ...(userId ? { userId } : {}),
        },

        $push: {
          books: entry,
        },
      }
    );

    return Boolean(retryResult.modifiedCount);
  }
}

exports.ensureOrderBooksInLibrary = async ({
  order,
  transaction,
}) => {
  if (!order || !transaction) {
    throw new Error(
      "Order and transaction are required for library persistence"
    );
  }

  const orderUserId = order.user || order.userId;

  console.log("[LIBRARY][ENSURE] input:", {
    orderId: order._id ? String(order._id) : null,

    orderUser: order.user
      ? String(order.user)
      : null,

    orderUserId: order.userId
      ? String(order.userId)
      : null,

    resolvedUserId: orderUserId
      ? String(orderUserId)
      : null,

    orderPaymentStatus: order.paymentStatus,

    transactionId: transaction._id
      ? String(transaction._id)
      : null,

    transactionReference: transaction.reference,

    transactionPaymentStatus: transaction.paymentStatus,

    itemCount: Array.isArray(order.items)
      ? order.items.length
      : 0,
  });

  /*
   * Only paid orders and paid transactions
   * can be added to the library.
   */
  if (
    order.paymentStatus !== "Paid" ||
    transaction.paymentStatus !== "Paid"
  ) {
    throw new Error(
      "Cannot persist library for unpaid order or transaction"
    );
  }

  const email = normalizeEmail(
    order.userInfo && order.userInfo.email
  );

  if (!email) {
    throw new Error(
      "Order email is required for library persistence"
    );
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return {
      email,
      userId: orderUserId
        ? String(orderUserId)
        : null,
      attempted: 0,
      added: 0,
      results: [],
    };
  }

  const bookIds = order.items.map(
    (item) => item.book
  );

  const books = await Book.find({
    _id: { $in: bookIds },
  });

  const booksById = new Map(
    books.map((book) => [
      String(book._id),
      book,
    ])
  );

  const results = [];

  for (const item of order.items) {
    const book = booksById.get(
      String(item.book)
    );

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
      purchasedAt:
        transaction.paidAt ||
        order.paidAt ||
        new Date(),
      bookSnapshot: buildBookSnapshot(book),
    };

    const added = await pushLibraryBook({
      email,
      userId: orderUserId,
      entry,
    });

    results.push({
      bookId: book._id,
      added,
      skipped: !added,
    });
  }

  const summary = {
    email,
    userId: orderUserId
      ? String(orderUserId)
      : null,

    attempted: results.length,

    added: results.filter(
      (result) => result.added
    ).length,

    results,
  };

  const savedLibrary = await Library.findOne({
    email,
    schemaVersion: 2,
  }).select(
    "_id userId email schemaVersion books"
  );

  console.log("[LIBRARY][ENSURE] output:", {
    ...summary,

    libraryId: savedLibrary
      ? String(savedLibrary._id)
      : null,

    savedUserId:
      savedLibrary && savedLibrary.userId
        ? String(savedLibrary.userId)
        : null,

    schemaVersion: savedLibrary
      ? savedLibrary.schemaVersion
      : null,

    bookCount: savedLibrary
      ? savedLibrary.books.length
      : 0,
  });

  return summary;
};