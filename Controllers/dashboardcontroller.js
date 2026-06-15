const ContinuityProduct = require("../Models/continuityProductSchema");
const ReflectionNote = require("../models/ReflectionNote");
const Bookmark = require("../models/Bookmark");
const ReadingProgress = require("../models/ReadingProgress");

exports.getDashboardOverview = async (req, res) => {
  try {
    const [
      continuityLibraryCount,
      reflectionNotesCount,
      bookmarksCount,
      learningPathways,
      recentlyOpened,
      readingProgress,
    ] = await Promise.all([
      ContinuityProduct.countDocuments(),
      ReflectionNote.countDocuments(),
      Bookmark.countDocuments(),

      ContinuityProduct.distinct("pathway"),

      ReadingProgress.find()
        .populate("product")
        .sort({ lastOpenedAt: -1 })
        .limit(3),

      ReadingProgress.find()
        .populate("product")
        .sort({ percentage: -1 })
        .limit(3),
    ]);

    res.status(200).json({
      stats: {
        continuityLibrary: continuityLibraryCount,
        reflectionNotes: reflectionNotesCount,
        bookmarks: bookmarksCount,
        learningPathways: learningPathways.length,
      },

      continueReading: recentlyOpened,

      readingProgress,

      insights: {
        recentActivity:
          "Opened Oral History Field Notes and saved a protected-resource bookmark.",

        recommendations:
          "Continue the Memory and Migration Workbook before starting the archive pathway.",

        preservedMaterials:
          "3 resource packets are ready for review in your continuity library.",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
