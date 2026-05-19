const Newsletter = require("../Models/Newsletter");
const { processNewsletterSend } = require("../Controllers/newsletterController");

async function processDueScheduledNewsletters() {
  const dueNewsletters = await Newsletter.find({
    status: "scheduled",
    scheduledAt: { $lte: new Date() },
  });

  for (const newsletter of dueNewsletters) {
    try {
      const result = await processNewsletterSend(newsletter, { dryRun: false });
      if (!result.ok) {
        console.error(
          `[NEWSLETTER][SCHEDULED][SKIP] id=${newsletter._id} reason=${result.payload?.message || "unknown"}`,
        );
      }
    } catch (error) {
      console.error(
        `[NEWSLETTER][SCHEDULED][ERROR] id=${newsletter._id}`,
        error,
      );
    }
  }
}

module.exports = {
  processDueScheduledNewsletters,
};
