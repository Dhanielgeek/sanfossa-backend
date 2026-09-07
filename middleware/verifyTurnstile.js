const axios = require("axios");

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies the Cloudflare Turnstile token submitted alongside a form.
 * Expects the frontend to send it as `turnstileToken` in the request body.
 */
module.exports = async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error(
      "[TURNSTILE] TURNSTILE_SECRET_KEY is not set — refusing request.",
    );
    return res
      .status(500)
      .json({ success: false, error: "Verification is not configured" });
  }

  const token = req.body && req.body.turnstileToken;

  if (!token) {
    return res
      .status(400)
      .json({ success: false, error: "Missing verification token" });
  }

  try {
    const response = await axios.post(
      VERIFY_URL,
      new URLSearchParams({
        secret,
        response: token,
        remoteip: req.ip,
      }),
    );

    if (!response.data.success) {
      console.warn("[TURNSTILE] verification failed:", response.data);
      return res
        .status(403)
        .json({ success: false, error: "Verification failed, please try again" });
    }

    // Don't forward the token to downstream handlers/models.
    delete req.body.turnstileToken;
    next();
  } catch (error) {
    console.error("[TURNSTILE] verify request error:", error.message);
    return res
      .status(502)
      .json({ success: false, error: "Verification service unavailable" });
  }
};
