// controllers/newsletterController.js
const Newsletter = require("../Models/Newsletter");
const Subscriber = require("../Models/Subscriber");
const { sendEmail, sendTemplate } = require("../services/emailservice");

// --- helpers ---
const isNonEmptyString = (s) => typeof s === "string" && s.trim().length > 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Concurrency limiter: run tasks with a cap on simultaneous promises.
 */
async function runWithConcurrency(items, handler, maxConcurrent = 10) {
  const results = [];
  let idx = 0;
  const workers = Array(Math.min(maxConcurrent, items.length))
    .fill(0)
    .map(async () => {
      while (idx < items.length) {
        const current = idx++;
        try {
          const r = await handler(items[current], current);
          results[current] = r;
        } catch (err) {
          results[current] = {
            success: false,
            error: err?.message || "Unknown error",
          };
        }
      }
    });
  await Promise.all(workers);
  return results;
}

/**
 * Simple retry wrapper for sendEmail with exponential backoff.
 */
async function sendWithRetry(opts, { retries = 2, baseDelayMs = 500 }) {
  let attempt = 0,
    lastErr;
  while (attempt <= retries) {
    try {
      return await sendEmail(opts);
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr || new Error("Failed to send email after retries");
}

async function processNewsletterSend(newsletter, controls = {}) {
  const {
    onlyVerified = true,
    batchSize = 100,
    batchDelayMs = 1000,
    maxConcurrency = 10,
    retries = 2,
    dryRun = false,
    customFilter = {},
  } = controls;
  const effectiveBatchSize = Math.max(1, batchSize);

  // Consent cannot be bypassed by caller-supplied filters.
  const filter = { ...customFilter, isActive: true };
  if (onlyVerified) filter.isVerified = true;

  const subscribers = await Subscriber.find(filter).select("email firstName").lean();

  const recipients = Array.from(new Map(subscribers.map((s) => [String(s.email || "").trim().toLowerCase(), s])).values()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s.email || "")));

  if (recipients.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      payload: { success: false, message: "No valid recipients found." },
    };
  }

  console.info(
    `[NEWSLETTER][SEND][START] id=${newsletter._id}, subject="${newsletter.subject}", recipients=${recipients.length}, dryRun=${dryRun}`,
  );

  let sent = 0;
  let failed = 0;
  const perRecipientResults = [];

  for (let i = 0; i < recipients.length; i += effectiveBatchSize) {
    const batch = recipients.slice(i, i + effectiveBatchSize);

    const batchResults = await runWithConcurrency(
      batch,
      async (subscriber) => {
        const email = subscriber.email;
        if (dryRun) {
          return { email, success: true, dryRun: true };
        }

        try {
          const info = newsletter.release?.productName
            ? await sendTemplate("newRelease", { to: email, firstName: subscriber.firstName || "there", ...newsletter.release })
            : await sendWithRetry({ to: email, subject: newsletter.subject, html: newsletter.content }, { retries });

          return { email, success: true, messageId: info?.messageId };
        } catch (err) {
          return {
            email,
            success: false,
            error: err?.message || "Unknown error",
          };
        }
      },
      maxConcurrency,
    );

    batchResults.forEach((result) => {
      perRecipientResults.push(result);
      if (result.success) sent++;
      else failed++;
    });

    if (i + effectiveBatchSize < recipients.length && batchDelayMs > 0) {
      await sleep(batchDelayMs);
    }
  }

  newsletter.status =
    failed === 0 && !dryRun ? "sent" : dryRun ? "dry-sent" : "partial";
  newsletter.sentAt = !dryRun ? new Date() : undefined;
  newsletter.scheduledAt = undefined;
  newsletter.metrics = {
    totalRecipients: recipients.length,
    sent,
    failed,
    dryRun,
    lastAttemptAt: new Date(),
  };
  await newsletter.save();

  console.info(
    `[NEWSLETTER][SEND][END] id=${newsletter._id}, total=${normalized.length}, sent=${sent}, failed=${failed}, dryRun=${dryRun}`,
  );

  return {
    ok: true,
    statusCode: 200,
    payload: {
      success: true,
      message: dryRun
        ? `Dry run complete: ${sent} would be sent, ${failed} would fail.`
        : `Newsletter processed: ${sent} sent, ${failed} failed.`,
      summary: {
        newsletterId: String(newsletter._id),
        subject: newsletter.subject,
        total: recipients.length,
        sent,
        failed,
        status: newsletter.status,
        dryRun,
      },
      results: perRecipientResults,
    },
  };
}

// @desc    Create a newsletter (subject + HTML content)
// @route   POST /api/v1/newsletter
// @access  Private (Admin)
exports.createNewsletter = async (req, res) => {
  try {
    const { subject, content, release } = req.body;

    if (!isNonEmptyString(subject)) {
      return res
        .status(400)
        .json({ success: false, message: "Subject is required." });
    }
    if (!isNonEmptyString(content) && !release) {
      return res
        .status(400)
        .json({ success: false, message: "HTML content is required." });
    }
    if (release && ![release.productName, release.shortDescription, release.topicOrTheme, release.productLink].every(isNonEmptyString)) {
      return res.status(400).json({ success: false, message: "release requires productName, shortDescription, topicOrTheme, and productLink." });
    }

    const newsletter = await Newsletter.create({
      subject: release ? "Something new has arrived at SankofaSeek" : subject.trim(),
      content: isNonEmptyString(content) ? content.trim() : "New release campaign",
      ...(release ? { release } : {}),
      status: "draft",
    });

    return res.status(201).json({ success: true, data: newsletter });
  } catch (err) {
    console.error("[NEWSLETTER][CREATE][ERROR]", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error creating newsletter." });
  }
};

// @desc    Send a newsletter to active subscribers
// @route   POST /api/v1/newsletter/:id/send
// @access  Private (Admin)
exports.sendNewsletter = async (req, res) => {
  const { id } = req.params;

  try {
    const newsletter = await Newsletter.findById(id);
    if (!newsletter) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    if (newsletter.status === "sent") {
      // Prevent accidental re-sends; switch to "resend" endpoint if needed
      return res.status(409).json({
        success: false,
        message: "Newsletter already marked as sent.",
      });
    }

    const result = await processNewsletterSend(newsletter, req.body || {});
    return res.status(result.statusCode).json(result.payload);
  } catch (err) {
    console.error("[NEWSLETTER][SEND][ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error while sending newsletter.",
    });
  }
};

exports.scheduleNewsletter = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res
        .status(400)
        .json({ success: false, message: "scheduledAt is required" });
    }

    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid future date required" });
    }

    const newsletter = await Newsletter.findById(id);
    if (!newsletter) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (newsletter.status === "sent") {
      return res.status(409).json({ success: false, message: "Already sent" });
    }

    newsletter.scheduledAt = date;
    newsletter.status = "scheduled";
    newsletter.metrics = {
      ...newsletter.metrics,
      lastAttemptAt: new Date(),
    };
    await newsletter.save();

    return res.json({
      success: true,
      message: "Newsletter scheduled successfully",
      data: {
        id: newsletter._id,
        scheduledAt: newsletter.scheduledAt,
      },
    });
  } catch (err) {
    console.error("[NEWSLETTER][SCHEDULE][ERROR]", err);
    res.status(500).json({
      success: false,
      message: "Failed to schedule newsletter",
    });
  }
};

exports.processNewsletterSend = processNewsletterSend;
