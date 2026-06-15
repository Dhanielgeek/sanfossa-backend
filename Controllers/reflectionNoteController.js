const ReflectionNote = require("../Models/ReflectionNote");

// Create Note
exports.createNote = async (req, res) => {
  try {
    const { productId, title, body } = req.body;

    const note = await ReflectionNote.create({
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
      message: error.message,
    });
  }
};

// Get Notes
exports.getNotes = async (req, res) => {
  try {
    const { search, productId } = req.query;

    let filter = {};

    if (productId && productId !== "All") {
      filter.productId = productId;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
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
      message: error.message,
    });
  }
};

// Single Note
exports.getNote = async (req, res) => {
  try {
    const note = await ReflectionNote.findById(req.params.id).populate(
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
      message: error.message,
    });
  }
};

// Update Note
exports.updateNote = async (req, res) => {
  try {
    const { title, body } = req.body;

    const note = await ReflectionNote.findByIdAndUpdate(
      req.params.id,
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
      message: error.message,
    });
  }
};

// Delete Note
exports.deleteNote = async (req, res) => {
  try {
    const note = await ReflectionNote.findByIdAndDelete(req.params.id);

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
      message: error.message,
    });
  }
};
