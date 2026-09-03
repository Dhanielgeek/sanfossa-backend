const crypto = require("crypto");
const Subscriber = require("../Models/Subscriber");

// Adjust this path if your email service is located elsewhere.
const { sendTemplate } = require("../services/emailservice");

/**
 * ============================================================================
 * Subscriber Controller
 * ============================================================================
 *
 * Resend is used only for email delivery.
 *
 * MongoDB / Subscriber model remains the source of truth for newsletter
 * subscriptions.
 *
 * Supported actions:
 * - Subscribe
 * - Unsubscribe
 * - Update subscription
 * - Verify subscription
 * - Get subscribers
 * ============================================================================
 */

/**
 * Validate an email address.
 */
const isValidEmail = (email) => {
  if (typeof email !== "string") {
    return false;
  }

  const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return basicPattern.test(email.trim().toLowerCase());
};

/**
 * Normalize email addresses consistently throughout the controller.
 */
const normalizeEmail = (email) => {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
};

/**
 * ============================================================================
 * UPDATE SUBSCRIPTION
 * ============================================================================
 *
 * Updates subscriber information using either:
 *
 * - email
 * - MongoDB _id
 *
 * Supported fields:
 * - email
 * - id / _id
 * - firstName
 * - lastName
 */
exports.updateSubscription = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const id = req.body?.id || req.body?._id || null;

    const firstName =
      req.body?.firstName !== undefined
        ? req.body.firstName
        : null;

    const lastName =
      req.body?.lastName !== undefined
        ? req.body.lastName
        : null;

    /**
     * We no longer accept/update mailerId because MailerLite has been removed.
     */
    if (!rawEmail && !id) {
      return res.status(400).json({
        success: false,
        message: "Email or id required",
      });
    }

    let filter;

    /**
     * Find by MongoDB ID when provided.
     */
    if (id) {
      filter = { _id: id };
    } else {
      const email = normalizeEmail(rawEmail);

      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address.",
        });
      }

      filter = { email };
    }

    const subscriber = await Subscriber.findOne(filter);

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Subscriber not found",
      });
    }

    const update = {};

    if (firstName !== null) {
      update.firstName =
        typeof firstName === "string"
          ? firstName.trim()
          : firstName;
    }

    if (lastName !== null) {
      update.lastName =
        typeof lastName === "string"
          ? lastName.trim()
          : lastName;
    }

    /**
     * If there is nothing to update, return the existing subscriber.
     */
    if (Object.keys(update).length === 0) {
      return res.status(200).json({
        success: true,
        message: "Subscription is already up to date",
        data: {
          id: subscriber._id,
        },
      });
    }

    const updatedSubscriber = await Subscriber.findOneAndUpdate(
      filter,
      { $set: update },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: {
        id: updatedSubscriber._id,
      },
    });
  } catch (err) {
    console.error("[UPDATE_SUBSCRIPTION][ERROR]", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * ============================================================================
 * SUBSCRIBE
 * ============================================================================
 *
 * Creates a local newsletter subscriber.
 *
 * Flow:
 *
 * 1. Validate email
 * 2. Check if subscriber already exists
 * 3. Reactivate inactive subscribers
 * 4. Create a new subscriber when necessary
 * 5. Send welcome email through Resend
 *
 * Resend failures do NOT delete the subscriber because subscription data
 * belongs to the database, not the email provider.
 */
exports.subscribe = async (req, res) => {
  let email = "";

  try {
    const rawEmail = req.body?.email;

    const firstName =
      typeof req.body?.firstName === "string"
        ? req.body.firstName.trim()
        : null;

    const lastName =
      typeof req.body?.lastName === "string"
        ? req.body.lastName.trim()
        : null;

    /**
     * ------------------------------------------------------------------------
     * Validate email
     * ------------------------------------------------------------------------
     */
    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    /**
     * ------------------------------------------------------------------------
     * Check existing subscriber
     * ------------------------------------------------------------------------
     */
    const existing = await Subscriber.findOne({ email }).select(
      "_id email firstName lastName isActive isVerified"
    );

    if (existing) {
      /**
       * If they previously unsubscribed, reactivate them.
       */
      if (!existing.isActive) {
        existing.isActive = true;

        /**
         * Keep them verified if they were already verified.
         * If your schema does not require this distinction, this is harmless.
         */
        if (existing.isVerified === undefined) {
          existing.isVerified = true;
        }

        await existing.save();

        /**
         * Send a welcome email when someone re-subscribes.
         *
         * We intentionally do this in the background so a Resend failure
         * does not cause the subscription request itself to fail.
         */
        sendTemplate("welcome", {
          to: email,
          firstName:
            firstName ||
            existing.firstName ||
            null,
        })
          .then(() => {
            console.log(
              `[RESEND] Welcome email sent to re-subscribed user: ${email}`
            );
          })
          .catch((emailError) => {
            console.error(
              `[RESEND][WELCOME][ERROR] Failed to send email to ${email}:`,
              emailError?.message || emailError
            );
          });

        return res.status(200).json({
          success: true,
          message: "Subscription reactivated successfully",
          data: {
            id: existing._id,
          },
        });
      }

      /**
       * Already subscribed.
       */
      return res.status(200).json({
        success: true,
        message: existing.isVerified
          ? "You are already subscribed."
          : "Subscription pending verification.",
        data: {
          id: existing._id,
        },
      });
    }

    /**
     * ------------------------------------------------------------------------
     * Create new subscriber
     * ------------------------------------------------------------------------
     *
     * The original controller had double opt-in disabled:
     *
     * const useDoubleOptIn = false;
     *
     * We preserve that behavior here.
     */
    const useDoubleOptIn = false;

    const verificationToken = useDoubleOptIn
      ? crypto.randomBytes(24).toString("hex")
      : undefined;

    const created = await Subscriber.create({
      email,
      firstName,
      lastName,
      isActive: true,
      isVerified: useDoubleOptIn ? false : true,
      verificationToken,
    });

    /**
     * ------------------------------------------------------------------------
     * Send response immediately
     * ------------------------------------------------------------------------
     *
     * The database operation has succeeded, so the subscriber is considered
     * subscribed even if Resend temporarily fails.
     */
    const response = {
      success: true,
      message: useDoubleOptIn
        ? "Thanks! Please check your email to confirm your subscription."
        : "Subscribed successfully",
      data: {
        id: created._id,
      },
    };

    res.status(201).json(response);

    /**
     * ------------------------------------------------------------------------
     * Send welcome email through Resend
     * ------------------------------------------------------------------------
     *
     * We do this after responding so the API request is not blocked by the
     * email provider.
     */
    sendTemplate("welcome", {
      to: email,
      firstName,
    })
      .then(() => {
        console.log(
          `[RESEND] Welcome email sent successfully to ${email}`
        );
      })
      .catch((emailError) => {
        console.error(
          `[RESEND][WELCOME][ERROR] Failed to send welcome email to ${email}:`,
          emailError?.message || emailError
        );
      });

    return;
  } catch (err) {
    /**
     * ------------------------------------------------------------------------
     * Handle duplicate email race condition
     * ------------------------------------------------------------------------
     */
    if (err?.code === 11000 && err?.keyPattern?.email) {
      try {
        const subscriber = await Subscriber.findOne({ email }).select(
          "_id email isActive isVerified"
        );

        return res.status(200).json({
          success: true,
          message: "You are already subscribed.",
          data: {
            id: subscriber?._id || null,
          },
        });
      } catch (lookupError) {
        console.error(
          "[SUBSCRIBE][DUPLICATE_LOOKUP][ERROR]",
          lookupError
        );

        return res.status(200).json({
          success: true,
          message: "You are already subscribed.",
        });
      }
    }

    console.error("[SUBSCRIBE][ERROR]", err);

    /**
     * If the response has already been sent, don't attempt to send another
     * response.
     */
    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * ============================================================================
 * UNSUBSCRIBE
 * ============================================================================
 *
 * We only update the local database.
 *
 * There is no MailerLite unsubscribe call anymore because MailerLite has
 * been completely removed from the system.
 */
exports.unsubscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;

    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    /**
     * Idempotent unsubscribe.
     *
     * Whether the subscriber exists or is already inactive, the endpoint
     * returns a successful response.
     */
    const subscriber = await Subscriber.findOneAndUpdate(
      { email },
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Unsubscribed successfully",
      data: {
        id: subscriber?._id || null,
      },
    });
  } catch (err) {
    console.error("[UNSUBSCRIBE][ERROR]", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * ============================================================================
 * GET SUBSCRIBERS
 * ============================================================================
 *
 * Returns all subscribers.
 *
 * verificationToken is excluded from the response for security.
 */
exports.getSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find()
      .select("-verificationToken -__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers,
    });
  } catch (err) {
    console.error("[GET_SUBSCRIBERS][ERROR]", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * ============================================================================
 * VERIFY SUBSCRIPTION
 * ============================================================================
 *
 * This endpoint remains available if you decide to enable double opt-in
 * later.
 *
 * Current subscribe() configuration has double opt-in disabled, so this
 * endpoint is not required for the normal subscription flow.
 */
exports.verify = async (req, res) => {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "Email and token are required.",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const subscriber = await Subscriber.findOne({
      email: normalizedEmail,
      verificationToken: token,
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token or email.",
      });
    }

    subscriber.isVerified = true;
    subscriber.isActive = true;

    /**
     * Remove the token after successful verification.
     */
    subscriber.verificationToken = undefined;

    await subscriber.save();

    return res.status(200).json({
      success: true,
      message: "Subscription verified successfully.",
      data: {
        id: subscriber._id,
      },
    });
  } catch (err) {
    console.error("[VERIFY][ERROR]", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};