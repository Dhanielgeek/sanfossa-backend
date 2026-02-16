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
        // Clear all groups before fetching from MailerLite to avoid race conditions
        if (SubscriberGroup) {
          try {
            const delRes = await SubscriberGroup.deleteMany({});
            console.log("[GROUP_CLEAR] deleted", delRes.deletedCount, "groups");
          } catch (delErr) {
            console.error("[GROUP_CLEAR][ERROR] failed to clear groups before sync", delErr?.message || delErr);
            throw delErr; // don't continue if we can't clear
          }
        }

        const groupsRes = await axios.get("https://connect.mailerlite.com/api/groups", {
          headers: {
            Authorization: `Bearer ${mlToken}`,
            Accept: "application/json",
          },
          timeout: 10000,
        });
        
        // safely extract array from various response formats
        let groups = [];
        if (Array.isArray(groupsRes.data)) {
          groups = groupsRes.data;
          console.log("[GROUP_FETCH] got array directly, count:", groups.length);
        } else if (groupsRes.data?.data && Array.isArray(groupsRes.data.data)) {
          groups = groupsRes.data.data;
          console.log("[GROUP_FETCH] got array from .data property, count:", groups.length);
        } else {
          console.warn("[GROUP_FETCH][WARN] unexpected groups response format:", typeof groupsRes.data, Object.keys(groupsRes.data || {}));
        }

        // determine last group id directly from response to avoid later DB dependence
        let lastGroupId = null;
        if (groups.length > 0) {
          const last = groups[groups.length - 1];
          lastGroupId = last?.id ?? last?.group_id ?? last?.uuid ?? last?.gid ?? null;
          if (lastGroupId) {
            console.log("[GROUP_SYNC] lastGroupId from response", lastGroupId);
          } else {
            console.warn("[GROUP_SYNC][WARN] could not extract group id from last group object", last);
          }
        } else {
          console.warn("[GROUP_SYNC][WARN] no groups returned from MailerLite");
        }

        if (SubscriberGroup && Array.isArray(groups) && groups.length > 0) {
          // process groups sequentially with a small delay to avoid rate limits
          for (const g of groups) {
            const gid = g?.id ?? g?.group_id ?? g?.uuid ?? g?.gid ?? null;
            const name = g?.name ?? g?.title ?? "";
            if (!gid) {
              console.warn("[GROUP_SYNC][WARN] group object has no id-like field", g);
              continue;
            }
            try {
              await SubscriberGroup.updateOne(
                { groupId: String(gid) },
                { $setOnInsert: { groupId: String(gid), name: String(name) } },
                { upsert: true }
              );
              console.log("[GROUP_SYNC] synced group", gid, "-", name);
            } catch (innerErr) {
              console.error("[GROUP_SYNC][ERROR] failed for group", gid, innerErr?.message || innerErr);
            }
            // small delay between DB writes
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else if (!groups || groups.length === 0) {
          console.warn("[GROUP_SYNC][WARN] no groups to sync");
        }

        try {
          // build fields object, excluding undefined values
          const fields = {};
          if (firstName && typeof firstName === "string") fields.name = firstName.trim();
          if (lastName && typeof lastName === "string") fields.last_name = lastName.trim();

          const mlBody = {
            email: email.trim(),
          };
          if (Object.keys(fields).length > 0) {
            mlBody.fields = fields;
          }

          console.log("[MAILERLITE] creating subscriber:", mlBody);
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
          const mlId = mlData?.id ?? mlData?.data?.id ?? mlData?.subscriber?.id ?? null;
          
          if (!mlId) {
            console.error("[MAILERLITE][ERROR] no subscriber id in response", mlData);
          } else {
            console.log("[MAILERLITE] subscriber created with id:", mlId);
            
            try {
              const updateRes = await Subscriber.findOneAndUpdate(
                { email },
                { mailerId: String(mlId) },
                { new: true }
              );
              if (!updateRes) {
                console.error("[SUBSCRIBE][ERROR] subscriber disappeared after creation", email);
              } else {
                console.log("[SUBSCRIBE] saved mailerId locally for", email);
              }
            } catch (uErr) {
              console.error("[SUBSCRIBE][ERROR] failed to save mailerId locally", uErr?.message || uErr);
            }

            if (lastGroupId) {
              if (!String(mlId).trim() || !String(lastGroupId).trim()) {
                console.error("[MAILERLITE][ERROR] invalid mlId or groupId:", mlId, lastGroupId);
              } else {
                try {
                  await axios.post(
                    `https://connect.mailerlite.com/api/subscribers/${String(mlId).trim()}/groups/${String(lastGroupId).trim()}`,
                    {},
                    {
                      headers: {
                        Authorization: `Bearer ${mlToken}`,
                        Accept: "application/json",
                      },
                      timeout: 10000,
                    }
                  );
                  console.log("[MAILERLITE] added subscriber", mlId, "to group", lastGroupId);
                } catch (addErr) {
                  console.error("[MAILERLITE][ERROR] failed to add subscriber to group:", addErr?.response?.data ?? addErr?.message ?? addErr);
                }
              }
            } else {
              console.warn("[GROUP_SYNC][WARN] no group id available to add subscriber");
            }
          }
        } catch (mlErr) {
          console.error("[MAILERLITE][ERROR] create subscriber failed:", mlErr?.response?.data ?? mlErr?.message ?? mlErr);
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
