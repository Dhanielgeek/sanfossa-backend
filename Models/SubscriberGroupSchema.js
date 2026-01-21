
// models/SubscriberGroup.js
import mongoose from "mongoose";

const SubscriberGroupSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const SubscriberGroup =
  mongoose.models.SubscriberGroup ||
  mongoose.model("SubscriberGroup", SubscriberGroupSchema);

export default SubscriberGroup;
