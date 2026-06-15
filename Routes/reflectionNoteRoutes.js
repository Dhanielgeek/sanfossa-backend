const express = require("express");

const router = express.Router();

const {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
} = require("../controllers/reflectionNoteController");

router.route("/").post(createNote).get(getNotes);

router.route("/:id").get(getNote).put(updateNote).delete(deleteNote);

module.exports = router;
