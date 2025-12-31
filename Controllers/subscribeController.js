const Subscriber = require("../Models/Subscriber");

exports.subscribe = async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ success: false, error: "Email required" });

  const existing = await Subscriber.findOne({ email });

  if (existing) {
    existing.isActive = true;
    await existing.save();
    return res.json({ success: true, message: "Re-subscribed" });
  }

  await Subscriber.create({ email });

  res.json({ success: true, message: "Subscribed successfully" });
};

exports.unsubscribe = async (req, res) => {
  const { email } = req.body;

  await Subscriber.findOneAndUpdate({ email }, { isActive: false });

  res.json({ success: true, message: "Unsubscribed" });
};
