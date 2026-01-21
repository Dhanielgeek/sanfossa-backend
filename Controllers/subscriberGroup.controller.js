
// controllers/subscriberGroup.controller.js
import SubscriberGroup from "../models/SubscriberGroup.js";

/** Map Mongo doc -> API shape */
function toApi(groupDoc) {
  if (!groupDoc) return null;
  return {
    id: groupDoc.groupId,
    name: groupDoc.name,
    createdAt: groupDoc.createdAt,
    updatedAt: groupDoc.updatedAt,
  };
}

/**
 * POST /api/subscriber-groups
 * Body: { id: string, name: string }
 */
export async function createSubscriberGroup(req, res) {
  try {
    const { id, name } = req.body || {};

    if (!id || typeof id !== "string" || !id.trim()) {
      return res
        .status(400)
        .json({ error: "Field 'id' is required and must be a non-empty string." });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ error: "Field 'name' is required and must be a non-empty string." });
    }

    // Enforce uniqueness on groupId
    const existing = await SubscriberGroup.findOne({ groupId: id.trim() }).lean();
    if (existing) {
      return res.status(409).json({ error: "Subscriber group with this id already exists." });
    }

    const created = await SubscriberGroup.create({
      groupId: id.trim(),
      name: name.trim(),
    });

    return res.status(201).json({ data: toApi(created) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Duplicate key: 'id' must be unique." });
    }
    console.error("createSubscriberGroup error:", err);
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
}

/**
 * PATCH /api/subscriber-groups/:id
 * Param :id -> current external id (groupId)
 * Body: { name?: string, id?: string } -> Can update both
 */
export async function updateSubscriberGroup(req, res) {
  try {
    const currentExternalId = req.params?.id?.trim();
    if (!currentExternalId) {
      return res.status(400).json({ error: "Path parameter ':id' is required." });
    }

    const { id: newExternalId, name } = req.body || {};
    const update = {};

    if (typeof name !== "undefined") {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "If provided, 'name' must be a non-empty string." });
      }
      update.name = name.trim();
    }

    if (typeof newExternalId !== "undefined") {
      if (typeof newExternalId !== "string" || !newExternalId.trim()) {
        return res.status(400).json({ error: "If provided, 'id' must be a non-empty string." });
      }
      update.groupId = newExternalId.trim();

      // Prevent conflict with another record's groupId
      const currentDoc = await SubscriberGroup.findOne({ groupId: currentExternalId }).lean();
      const conflicting = await SubscriberGroup.findOne({
        groupId: update.groupId,
        _id: { $ne: currentDoc?._id },
      }).lean();

      if (conflicting) {
        return res.status(409).json({ error: "Another group already uses this 'id'." });
      }
    }

    if (Object.keys(update).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields to update. Provide 'name' and/or 'id'." });
    }

    const updated = await SubscriberGroup.findOneAndUpdate(
      { groupId: currentExternalId },
      { $set: update },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Subscriber group not found." });
    }

    return res.status(200).json({ data: toApi(updated) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Duplicate key: 'id' must be unique." });
    }
    console.error("updateSubscriberGroup error:", err);
    return res.status(500).json({ error: "Server error. Please try again later." });
  }
}
