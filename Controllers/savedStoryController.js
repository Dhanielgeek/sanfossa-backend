const mongoose = require("mongoose");
const SavedStory = require("../Models/SavedStory");
const Book = require("../Models/BooksModel");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

// Shape expected by the dashboard's Saved Stories page.
const toClient = (saved) => ({
  id: String(saved._id),
  storyId: String(saved.book?._id || saved.book),
  title: saved.book?.title || "Untitled story",
  category: saved.book?.category || "",
  image: saved.book?.coverImage || undefined,
  dateSaved: saved.createdAt,
});

/**
 * GET /api/saved-stories   (protect)
 */
exports.getSavedStories = async (req, res) => {
  try {
    const saved = await SavedStory.find({ user: req.user._id })
      .populate("book", "title category coverImage status")
      .sort({ createdAt: -1 })
      .lean();

    // Skip stories that were deleted since they were saved.
    return res
      .status(200)
      .json(saved.filter((item) => item.book).map(toClient));
  } catch (error) {
    console.error("[SAVED STORIES][LIST]", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load saved stories" });
  }
};

/**
 * POST /api/saved-stories/:bookId   (protect)
 * Saving a story twice is not an error; it returns the existing entry.
 */
exports.saveStory = async (req, res) => {
  const { bookId } = req.params;

  if (!isValidId(bookId)) {
    return res.status(404).json({ success: false, message: "Story not found" });
  }

  try {
    const book = await Book.findOne({ _id: bookId, status: "published" })
      .select("title category coverImage")
      .lean();

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Story not found" });
    }

    const saved = await SavedStory.findOneAndUpdate(
      { user: req.user._id, book: book._id },
      { $setOnInsert: { user: req.user._id, book: book._id } },
      { upsert: true, new: true },
    ).lean();

    return res.status(201).json(toClient({ ...saved, book }));
  } catch (error) {
    // Two saves at the same moment: the other request created it.
    if (error.code === 11000) {
      const saved = await SavedStory.findOne({
        user: req.user._id,
        book: bookId,
      })
        .populate("book", "title category coverImage")
        .lean();
      return res.status(200).json(toClient(saved));
    }

    console.error("[SAVED STORIES][SAVE]", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to save story" });
  }
};

/**
 * DELETE /api/saved-stories/:bookId   (protect)
 */
exports.removeSavedStory = async (req, res) => {
  const { bookId } = req.params;

  if (!isValidId(bookId)) {
    return res
      .status(404)
      .json({ success: false, message: "Saved story not found" });
  }

  try {
    const removed = await SavedStory.findOneAndDelete({
      user: req.user._id,
      book: bookId,
    });

    if (!removed) {
      return res
        .status(404)
        .json({ success: false, message: "Saved story not found" });
    }

    return res.status(200).json({ message: "Story removed" });
  } catch (error) {
    console.error("[SAVED STORIES][REMOVE]", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Unable to remove saved story" });
  }
};
