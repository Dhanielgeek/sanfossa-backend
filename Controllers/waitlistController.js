const Waitlist = require("../Models/Waitlist");

const isValidEmail = (email) => {
  if (typeof email !== "string") return false;
  const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicPattern.test(email.trim().toLowerCase());
};

exports.joinWaitlist = async (req, res) => {
  try {
    const rawEmail = req.body?.email;

    if (!rawEmail) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const existingEntry = await Waitlist.findOne({ email }).select("_id");
    if (existingEntry) {
      return res.status(200).json({
        success: true,
        message: "Email already on waitlist.",
        data: { id: existingEntry._id },
      });
    }

    const entry = await Waitlist.create({ email });

    return res.status(201).json({
      success: true,
      message: "Joined waitlist successfully.",
      data: { id: entry._id, email: entry.email },
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) {
      const existingEntry = await Waitlist.findOne({ email: req.body?.email?.trim?.().toLowerCase?.() }).select("_id");
      return res.status(200).json({
        success: true,
        message: "Email already on waitlist.",
        data: { id: existingEntry?._id },
      });
    }

    console.error("[WAITLIST_JOIN][ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getWaitlistEntries = async (req, res) => {
  try {
    const waitlistEntries = await Waitlist.find()
      .select("-__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: waitlistEntries.length,
      data: waitlistEntries,
    });
  } catch (error) {
    console.error("[GET_WAITLIST][ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
