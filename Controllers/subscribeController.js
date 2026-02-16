// controllers/subscriberController.js
const crypto = require("crypto");
const Subscriber = require("../Models/Subscriber");
const axios = require("axios");

// Try to import SubscriberGroup model (file exports may be ESM default)
let SubscriberGroup = null;
try {
  SubscriberGroup = require("../Models/SubscriberGroupSchema");
  if (SubscriberGroup && SubscriberGroup.default) SubscriberGroup = SubscriberGroup.default;
} catch (e) {
  SubscriberGroup = null;
}

const isValidEmail = (email) => {
  if (typeof email !== "string") return false;
  const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicPattern.test(email.trim().toLowerCase());
};

exports.updateSubscription = async (req, res) => {
  try {
    // Accept update by email or by local id. Accepts fields: email?, id?, firstName?, lastName?, mailerId?
    const rawEmail = req.body?.email;
    const id = req.body?.id || req.body?._id || null;
    const firstName = req.body?.firstName || null;
    const lastName = req.body?.lastName || null;
    const mailerId = req.body?.mailerId || null;

    if (!rawEmail && !id) {
      return res.status(400).json({ success: false, message: "Email or id required" });
    }

    let filter = {};
    if (id) {
      filter = { _id: id };
    } else {
      const email = rawEmail.trim().toLowerCase();
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: "Please provide a valid email address." });
      }
      filter = { email };
    }

    const subscriber = await Subscriber.findOne(filter);
    if (!subscriber) {
      return res.status(404).json({ success: false, message: "Subscriber not found" });
    }

    const update = {};
    if (firstName !== null) update.firstName = firstName;
    if (lastName !== null) update.lastName = lastName;
    if (mailerId !== null) update.mailerId = mailerId;

    await Subscriber.findOneAndUpdate(filter, update, { new: true });
    return res.status(200).json({ success: true, message: "Subscription updated successfully", data: { id: subscriber._id } });
  } catch (err) {
    console.error("[UPDATE_SUBSCRIPTION][ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.subscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const firstName = req.body?.firstName || null;
    const lastName = req.body?.lastName || null;

    if (!rawEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email required" });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide a valid email address.",
        });
    }

    // Try to find existing subscriber
    const existing = await Subscriber.findOne({ email }).select(
      "_id isActive isVerified"
    );

    if (existing) {
      // Reactivate; keep idempotency and avoid info leak
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
      }
      return res.status(200).json({
        success: true,
        message: existing.isVerified
          ? "You are subscribed. " + existing.firstName
          : "Subscription pending verification.",
      });
    }

    // Optional double opt-in (set useDoubleOptIn = true to enable)
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

    // --- MailerLite sync: fetch groups, sync groups to DB, create external subscriber ---
    // Allow token to come from a header (for testing) or from server env var
    const mlToken = req.headers["x-mailerlite-token"] || process.env.MAILERLITE_TOKEN;

    if (mlToken) {
      try {
        // 1) Retrieve all groups from MailerLite
        const groupsRes = await axios.get("https://connect.mailerlite.com/api/groups", {
          headers: {
            Authorization: `Bearer ${mlToken}`,
            Accept: "application/json",
          },
          timeout: 10000,
        });

        const groups = Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.data ?? [];

        // 2) Sync groups to database (insert only if not present)
        if (SubscriberGroup && Array.isArray(groups)) {
          for (const g of groups) {
            const gid = g?.id ?? g?.group_id ?? g?.uuid ?? g?.gid ?? null;
            const name = g?.name ?? g?.title ?? "";
            if (!gid) continue;
            try {
              await SubscriberGroup.updateOne(
                { groupId: String(gid) },
                { $setOnInsert: { groupId: String(gid), name: String(name) } },
                { upsert: true }
              );
            } catch (innerErr) {
              console.warn("[GROUP_SYNC][WARN] failed for group", gid, innerErr?.message || innerErr);
            }
          }
        }

        // 3) Create subscriber in MailerLite
        try {
          const mlBody = {
            email,
            fields: {
              name: firstName || undefined,
              last_name: lastName || undefined,
            },
          };

          const mlCreateRes = await axios.post(
            "https://connect.mailerlite.com/api/subscribers",
            mlBody,
            {
              headers: {
                Authorization: `Bearer ${mlToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              timeout: 10000,
            }
          );

          // If MailerLite returns an id, update local subscriber with mailerId
          const mlData = mlCreateRes.data;
          const mlId = mlData?.id ?? mlData?.data?.id ?? null;
          if (mlId) {
            try {
              await Subscriber.findOneAndUpdate({ email }, { mailerId: String(mlId) }, { new: true });
            } catch (uErr) {
              console.warn("[SUBSCRIBE][WARN] failed to save mailerId locally", uErr?.message || uErr);
            }

            // After saving the mailerId, attempt to subscribe this new user
            // to the most recently created group in our database.
            if (SubscriberGroup) {
              try {
                const lastGroup = await SubscriberGroup.findOne()
                  .sort({ createdAt: -1 })
                  .select("groupId");
                const groupId = lastGroup?.groupId ?? null;
                if (groupId) {
                  try {
                    await axios.post(
                      `https://connect.mailerlite.com/api/subscribers/${mlId}/groups/${groupId}`,
                      null,
                      {
                        headers: {
                          Authorization: `Bearer ${mlToken}`,
                          Accept: "application/json",
                        },
                        timeout: 10000,
                      }
                    );
                  } catch (addErr) {
                    console.warn("[MAILERLITE][WARN] failed to add subscriber to group", addErr?.response?.data ?? addErr?.message ?? addErr);
                  }
                }
              } catch (grpErr) {
                console.warn("[GROUP_LOOKUP][WARN] could not fetch latest group", grpErr?.message ?? grpErr);
              }
            }
          }
        } catch (mlErr) {
          console.warn("[MAILERLITE][ERROR] create subscriber failed:", mlErr?.response?.data ?? mlErr?.message ?? mlErr);
          // don't throw — backend subscription should not fail because of third-party errors
        }
      } catch (errGroups) {
        console.warn("[MAILERLITE][WARN] failed to fetch groups or sync:", errGroups?.response?.data ?? errGroups?.message ?? errGroups);
      }
    } else {
      console.warn("[MAILERLITE][INFO] no MailerLite token provided; skipping external sync");
    }

    // If double opt-in, send verification email here via your email service.
    // await sendVerificationEmail(email, verificationToken);

    // Attempt to fetch the most recent local record to include id + mailerId
    try {
      const latest = await Subscriber.findOne({ email }).select("_id mailerId");
      return res.status(201).json({
        success: true,
        message: useDoubleOptIn
          ? "Thanks! Please check your email to confirm your subscription."
          : "Subscribed successfully",
        data: { id: latest?._id, mailerId: latest?.mailerId ?? null },
      });
    } catch (finalErr) {
      // Still return success even if fetching the id failed
      return res.status(201).json({
        success: true,
        message: useDoubleOptIn
          ? "Thanks! Please check your email to confirm your subscription."
          : "Subscribed successfully",
      });
    }
  } catch (err) {
    // Handle duplicate key race condition (E11000)
    if (err?.code === 11000 && err?.keyPattern?.email) {
      try {
        const sub = await Subscriber.findOne({ email }).select("_id mailerId");
        return res.status(200).json({
          success: true,
          message: "You are already subscribed.",
          data: { id: sub?._id, mailerId: sub?.mailerId ?? null },
        });
      } catch (lookupErr) {
        return res.status(200).json({
          success: true,
          message: "You are already subscribed.",
        });
      }
    }
    console.error("[SUBSCRIBE][ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email required" });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide a valid email address.",
        });
    }

    // Idempotent: deactivate if exists; respond success either way
    await Subscriber.findOneAndUpdate(
      { email },
      { isActive: false },
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Unsubscribed" });
  } catch (err) {
    console.error("[UNSUBSCRIBE][ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

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
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Optional: Verify endpoint for double opt-in
exports.verify = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) {
      return res
        .status(400)
        .json({ success: false, message: "Email and token are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const sub = await Subscriber.findOne({
      email: normalizedEmail,
      verificationToken: token,
    });
    if (!sub) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid verification token or email.",
        });
    }

    sub.isVerified = true;
    sub.isActive = true;
    sub.verificationToken = undefined;
    await sub.save();

    return res
      .status(200)
      .json({ success: true, message: "Subscription verified." });
  } catch (err) {
    console.error("[VERIFY][ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
