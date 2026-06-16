const express = require("express");
const router = express.Router();

const {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
} = require("../Controllers/reflectionNoteController");

// Create note
router.post("/", createNote);

// Get all notes
router.get("/", getNotes);

// Get single note
router.get("/:id", getNote);

// Update note
router.put("/:id", updateNote);

// Delete note
router.delete("/:id", deleteNote);

module.exports = router;
