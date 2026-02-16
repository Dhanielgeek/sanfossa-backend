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

    // respond early so the caller isn't blocked by external API work
    res.status(201).json({
      success: true,
      message: useDoubleOptIn
        ? "Thanks! Please check your email to confirm your subscription."
        : "Subscribed successfully",
      data: { id: created._id },
    });

    // background synchronization with MailerLite
    (async () => {
      const mlToken = req.headers["x-mailerlite-token"] || process.env.MAILERLITE_TOKEN;
      if (!mlToken) {
        console.warn("[MAILERLITE][INFO] no MailerLite token provided; skipping external sync");
        return;
      }

      try {
        if (SubscriberGroup) {
          try {
            await SubscriberGroup.deleteMany({});
          } catch (delErr) {
            console.warn("[GROUP_CLEAR][WARN] failed to clear groups before sync", delErr?.message || delErr);
          }
        }

        const groupsRes = await axios.get("https://connect.mailerlite.com/api/groups", {
          headers: {
            Authorization: `Bearer ${mlToken}`,
            Accept: "application/json",
          },
          timeout: 10000,
        });
        const groups = Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.data ?? [];

        // determine last group id directly from response to avoid later DB dependence
        let lastGroupId = null;
        if (Array.isArray(groups) && groups.length) {
          const last = groups[groups.length - 1];
          lastGroupId = last?.id ?? last?.group_id ?? last?.uuid ?? last?.gid ?? null;
          if (lastGroupId) {
            console.log("[GROUP_SYNC] lastGroupId from response", lastGroupId);
          }
        }

        if (SubscriberGroup && Array.isArray(groups)) {
          await Promise.all(
            groups.map(async (g) => {
              const gid = g?.id ?? g?.group_id ?? g?.uuid ?? g?.gid ?? null;
              const name = g?.name ?? g?.title ?? "";
              if (!gid) return;
              try {
                await SubscriberGroup.updateOne(
                  { groupId: String(gid) },
                  { $setOnInsert: { groupId: String(gid), name: String(name) } },
                  { upsert: true }
                );
              } catch (innerErr) {
                console.warn("[GROUP_SYNC][WARN] failed for group", gid, innerErr?.message || innerErr);
              }
            })
          );
        }

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
          const mlData = mlCreateRes.data;
          const mlId = mlData?.id ?? mlData?.data?.id ?? null;
          if (mlId) {
            try {
              await Subscriber.findOneAndUpdate({ email }, { mailerId: String(mlId) }, { new: true });
            } catch (uErr) {
              console.warn("[SUBSCRIBE][WARN] failed to save mailerId locally", uErr?.message || uErr);
            }

            // use lastGroupId computed above rather than querying DB
            if (lastGroupId) {
              try {
                await axios.post(
                  `https://connect.mailerlite.com/api/subscribers/${mlId}/groups/${lastGroupId}`,
                  null,
                  {
                    headers: {
                      Authorization: `Bearer ${mlToken}`,
                      Accept: "application/json",
                    },
                    timeout: 10000,
                  }
                );
                console.log("[MAILERLITE] added subscriber to group", lastGroupId);
              } catch (addErr) {
                console.warn("[MAILERLITE][WARN] failed to add subscriber to group", addErr?.response?.data ?? addErr?.message ?? addErr);
              }
            } else {
              console.warn("[GROUP_SYNC][WARN] no group id available to add subscriber");
            }
          }
        } catch (mlErr) {
          console.warn("[MAILERLITE][ERROR] create subscriber failed:", mlErr?.response?.data ?? mlErr?.message ?? mlErr);
        }
      } catch (errGroups) {
        console.warn("[MAILERLITE][WARN] failed to fetch groups or sync:", errGroups?.response?.data ?? errGroups?.message ?? errGroups);
      }
    })().catch((bgErr) => {
      console.error("[SUBSCRIBE][BG_ERROR] unexpected error during background sync", bgErr);
    });

    return;
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
