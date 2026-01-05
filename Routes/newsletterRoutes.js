// routes/newsletter.js
const express = require("express");
const router = express.Router();
const { adminProtect } = require("../middleware/authAdmin");
const {
  createNewsletter,
  sendNewsletter,
} = require("../Controllers/newsletterController");

// Optional: lightweight body validation middleware for send controls
function validateSendControls(req, res, next) {
  const {
    onlyVerified,
    batchSize,
    batchDelayMs,
    maxConcurrency,
    retries,
    dryRun,
    customFilter,
  } = req.body || {};

  const isBool = (v) => typeof v === "boolean";
  const isInt = (v) => Number.isInteger(v) && v >= 0;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  if (typeof onlyVerified !== "undefined" && !isBool(onlyVerified)) {
    return res
      .status(400)
      .json({ success: false, message: "onlyVerified must be a boolean." });
  }
  if (typeof dryRun !== "undefined" && !isBool(dryRun)) {
    return res
      .status(400)
      .json({ success: false, message: "dryRun must be a boolean." });
  }
  if (typeof batchSize !== "undefined" && !isInt(batchSize)) {
    return res.status(400).json({
      success: false,
      message: "batchSize must be a non-negative integer.",
    });
  }
  if (typeof batchDelayMs !== "undefined" && !isInt(batchDelayMs)) {
    return res.status(400).json({
      success: false,
      message: "batchDelayMs must be a non-negative integer (ms).",
    });
  }
  if (typeof maxConcurrency !== "undefined" && !isInt(maxConcurrency)) {
    return res.status(400).json({
      success: false,
      message: "maxConcurrency must be a non-negative integer.",
    });
  }
  if (
    typeof retries !== "undefined" &&
    typeof retries !== "undefined" &&
    !isInt(retries)
  ) {
    return res.status(400).json({
      success: false,
      message: "retries must be a non-negative integer.",
    });
  }
  if (typeof customFilter !== "undefined" && !isObj(customFilter)) {
    return res
      .status(400)
      .json({ success: false, message: "customFilter must be an object." });
  }

  next();
}

router.post("/", adminProtect, createNewsletter);
router.post("/:id/send", adminProtect, validateSendControls, sendNewsletter);

module.exports = router;
