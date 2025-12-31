const Newsletter = require("../Models/Newsletter");

const Subscriber = require("../Models/Subscriber");
const { sendEmail } = require("../services/emailservice");

exports.createNewsletter = async (req, res) => {
  const { subject, content } = req.body;

  const newsletter = await Newsletter.create({ subject, content });

  res.json({ success: true, data: newsletter });
};

exports.sendNewsletter = async (req, res) => {
  const { id } = req.params;

  const newsletter = await Newsletter.findById(id);
  if (!newsletter)
    return res.status(404).json({ success: false, error: "Not found" });

  const subscribers = await Subscriber.find({ isActive: true });

  for (const sub of subscribers) {
    await sendEmail({
      to: sub.email,
      subject: newsletter.subject,
      html: newsletter.content,
    });
  }

  newsletter.status = "sent";
  newsletter.sentAt = new Date();
  await newsletter.save();

  res.json({ success: true, message: "Newsletter sent" });
};
