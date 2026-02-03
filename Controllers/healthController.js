const axios = require('axios');

exports.checkMailerLite = async (req, res) => {
  try {
    const token = process.env.MAILERLITE_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, message: 'MAILERLITE_TOKEN not configured on server' });
    }

    const resp = await axios.get('https://connect.mailerlite.com/api/groups', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 8000,
    });

    const groups = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];

    return res.status(200).json({
      success: true,
      valid: true,
      provider: 'mailerlite',
      groups: { count: Array.isArray(groups) ? groups.length : null },
    });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return res.status(401).json({ success: false, valid: false, message: 'Invalid MailerLite token' });
    }
    console.error('[HEALTH][MAILERLITE][ERROR]', err?.response?.data ?? err?.message ?? err);
    return res.status(500).json({ success: false, message: 'MailerLite health check failed' });
  }
};
