const StoryOptionList = require("../Models/StoryOptionList");
const { STORY_OPTION_FIELDS } = require("../Models/StoryOptionList");

// The lists the story form shipped with. Used once, the first time a
// field is read, so existing behaviour is unchanged until an admin edits.
const DEFAULT_OPTIONS = {
  category: [
    "Folklore & Legends",
    "Historical Fiction",
    "Oral Traditions",
    "Biography & Memoirs",
    "Cultural Tales",
    "War & Resistance",
    "Family Stories",
    "Mythology",
  ],
  historicalPeriod: [
    "Ancient Times (Before 500 CE)",
    "Medieval Period (500-1500 CE)",
    "Early Modern (1500-1800)",
    "Colonial Era (1800-1960)",
    "Independence Era (1960-1990)",
    "Contemporary (1990-Present)",
  ],
  ageRating: ["All Ages", "8+", "12+", "16+", "18+"],
};

const MAX_OPTION_LENGTH = 120;
const MAX_OPTIONS_PER_FIELD = 100;

const isKnownField = (field) => STORY_OPTION_FIELDS.includes(field);

const normalizeValue = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Returns every field's list, creating any missing list from the defaults.
 * An admin who removes every option gets an empty list, not the defaults
 * again, because the document still exists.
 */
const loadAllLists = async () => {
  await Promise.all(
    STORY_OPTION_FIELDS.map((field) =>
      StoryOptionList.updateOne(
        { field },
        { $setOnInsert: { field, values: DEFAULT_OPTIONS[field] } },
        { upsert: true },
      ).catch((error) => {
        // Another request created this list at the same moment.
        if (error.code !== 11000) throw error;
      }),
    ),
  );

  const lists = await StoryOptionList.find({
    field: { $in: STORY_OPTION_FIELDS },
  }).lean();

  return Object.fromEntries(
    STORY_OPTION_FIELDS.map((field) => [
      field,
      lists.find((list) => list.field === field)?.values || [],
    ]),
  );
};

/**
 * GET /api/admin/story-options
 */
exports.getStoryOptions = async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: await loadAllLists() });
  } catch (error) {
    console.error("[STORY OPTIONS][GET]", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Unable to load story options" });
  }
};

/**
 * POST /api/admin/story-options/:field   body: { value }
 */
exports.addStoryOption = async (req, res) => {
  const { field } = req.params;
  const value = normalizeValue(req.body && req.body.value);

  if (!isKnownField(field)) {
    return res.status(404).json({ success: false, error: "Unknown field" });
  }

  if (!value) {
    return res
      .status(400)
      .json({ success: false, error: "Option cannot be empty" });
  }

  if (value.length > MAX_OPTION_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Option must be ${MAX_OPTION_LENGTH} characters or fewer`,
    });
  }

  try {
    const lists = await loadAllLists();
    const current = lists[field];

    if (current.some((item) => item.toLowerCase() === value.toLowerCase())) {
      return res
        .status(409)
        .json({ success: false, error: `"${value}" is already in the list` });
    }

    if (current.length >= MAX_OPTIONS_PER_FIELD) {
      return res.status(400).json({
        success: false,
        error: `A list can have at most ${MAX_OPTIONS_PER_FIELD} options`,
      });
    }

    await StoryOptionList.updateOne({ field }, { $addToSet: { values: value } });

    return res
      .status(201)
      .json({ success: true, data: await loadAllLists() });
  } catch (error) {
    console.error("[STORY OPTIONS][ADD]", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Unable to add option" });
  }
};

/**
 * DELETE /api/admin/story-options/:field   body: { value }
 * Stories that already use the value keep it; it just stops being offered.
 */
exports.removeStoryOption = async (req, res) => {
  const { field } = req.params;
  const value = normalizeValue(req.body && req.body.value);

  if (!isKnownField(field)) {
    return res.status(404).json({ success: false, error: "Unknown field" });
  }

  if (!value) {
    return res
      .status(400)
      .json({ success: false, error: "Option cannot be empty" });
  }

  try {
    await loadAllLists();
    const result = await StoryOptionList.updateOne(
      { field },
      { $pull: { values: value } },
    );

    if (!result.modifiedCount) {
      return res
        .status(404)
        .json({ success: false, error: `"${value}" is not in the list` });
    }

    return res
      .status(200)
      .json({ success: true, data: await loadAllLists() });
  } catch (error) {
    console.error("[STORY OPTIONS][REMOVE]", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Unable to remove option" });
  }
};
