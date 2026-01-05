
// controllers/subscriberController.js
const crypto = require('crypto');
const Subscriber = require('../Models/Subscriber');

const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicPattern.test(email.trim().toLowerCase());
};

exports.subscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Try to find existing subscriber
    const existing = await Subscriber.findOne({ email }).select('_id isActive isVerified');

    if (existing) {
      // Reactivate; keep idempotency and avoid info leak
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
      }
      return res.status(200).json({
        success: true,
        message: existing.isVerified
          ? 'You are subscribed.'
          : 'Subscription pending verification.'
      });
    }

    // Optional double opt-in (set useDoubleOptIn = true to enable)
    const useDoubleOptIn = false;
    const verificationToken = useDoubleOptIn ? crypto.randomBytes(24).toString('hex') : undefined;

    await Subscriber.create({
      email,
      isActive: true,
      isVerified: useDoubleOptIn ? false : true,
      verificationToken
    });

    // If double opt-in, send verification email here via your email service.
    // await sendVerificationEmail(email, verificationToken);

    return res.status(201).json({
      success: true,
      message: useDoubleOptIn
        ? 'Thanks! Please check your email to confirm your subscription.'
        : 'Subscribed successfully'
    });
  } catch (err) {
    // Handle duplicate key race condition (E11000)
    if (err?.code === 11000 && err?.keyPattern?.email) {
      return res.status(200).json({
        success: true,
        message: 'You are already subscribed.'
      });
    }
    console.error('[SUBSCRIBE][ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Idempotent: deactivate if exists; respond success either way
    await Subscriber.findOneAndUpdate(
      { email },
      { isActive: false },
      { new: true }
    );

    return res.status(200).json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    console.error('[UNSUBSCRIBE][ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Optional: Verify endpoint for double opt-in
exports.verify = async (req, res) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) {
      return res.status(400).json({ success: false, message: 'Email and token are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const sub = await Subscriber.findOne({ email: normalizedEmail, verificationToken: token });
    if (!sub) {
      return res.status(400).json({ success: false, message: 'Invalid verification token or email.' });
    }

    sub.isVerified = true;
    sub.isActive = true;
    sub.verificationToken = undefined;
    await sub.save();

    return res.status(200).json({ success: true, message: 'Subscription verified.' });
  } catch (err) {
    console.error('[VERIFY][ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};