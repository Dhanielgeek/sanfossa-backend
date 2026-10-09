const mongoose = require("mongoose");

/**
 * Admin-managed choices for the story form's select fields
 * (category, historical period, age rating). One document per field.
 */
const STORY_OPTION_FIELDS = ["category", "historicalPeriod", "ageRating"];

const StoryOptionListSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      enum: STORY_OPTION_FIELDS,
      required: true,
      unique: true,
    },
    values: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StoryOptionList", StoryOptionListSchema);
module.exports.STORY_OPTION_FIELDS = STORY_OPTION_FIELDS;
