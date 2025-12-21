const express = require("express");
const router = express.Router();
const Book = require("../Models/BooksModel.js");
const { protect, authorize } = require("../middleware/auth"); // Auth middleware from before

// routes/bookRoutes.js (Addition)

const { updateInventory } = require("../Controllers/bookController");
// ... other imports

// ... existing routes

// @route   PUT /api/v1/books/:id/inventory
// @desc    Update only the stock quantity (e.g., restocking or manual adjustment)
// @access  Private (Admin/Editor Only)
router.put(
  "/:id/inventory",
  protect,
  authorize("admin", "editor"),
  updateInventory
);

// ... module.exports

// @route   POST /api/v1/books
// @desc    Add a new book to the inventory
// @access  Private (Admin/Editor Only)
router.post("/", protect, authorize("admin", "editor"), async (req, res) => {
  // Controller logic to create a book and save to DB
  try {
    const book = await Book.create(req.body);
    res.status(201).json({ success: true, data: book });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// @route   GET /api/v1/books
// @desc    Get all books (public for browsing)
// @access  Public
router.get("/", async (req, res) => {
  try {
    const books = await Book.find();
    res.status(200).json({ success: true, count: books.length, data: books });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

// [Other CRUD routes like PUT /:id (Update) and DELETE /:id (Remove) would go here]

module.exports = router;
