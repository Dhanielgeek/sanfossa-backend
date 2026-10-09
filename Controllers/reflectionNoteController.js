const ReflectionNote = require("../Models/ReflectionNote");

const escapeRegex = (value) =>
  String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ownNote = (req) => ({ _id: req.params.id, user: req.user._id });

// Create Note
exports.createNote = async (req, res) => {
  try {
    const { productId, title, body } = req.body;

    const note = await ReflectionNote.create({
      user: req.user._id,
      productId,
      title,
      body,
      excerpt: body.slice(0, 90),
    });

    res.status(201).json({
      success: true,
      note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// Get Notes
exports.getNotes = async (req, res) => {
  try {
    const { search, productId } = req.query;

    let filter = { user: req.user._id };

    if (productId && productId !== "All") {
      filter.productId = productId;
    }

    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { title: { $regex: pattern, $options: "i" } },
        { body: { $regex: pattern, $options: "i" } },
      ];
    }

    const notes = await ReflectionNote.find(filter)
      .populate("productId", "title")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: notes.length,
      notes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// Single Note
exports.getNote = async (req, res) => {
  try {
    const note = await ReflectionNote.findOne(ownNote(req)).populate(
      "productId",
      "title",
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// Update Note
exports.updateNote = async (req, res) => {
  try {
    const { title, body } = req.body;

    const note = await ReflectionNote.findOneAndUpdate(
      ownNote(req),
      {
        title,
        body,
        excerpt: body?.slice(0, 90),
      },
      {
        new: true,
      },
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// Delete Note
exports.deleteNote = async (req, res) => {
  try {
    const note = await ReflectionNote.findOneAndDelete(ownNote(req));

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
