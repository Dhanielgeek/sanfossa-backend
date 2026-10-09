const express = require('express');
const router = express.Router();

const { checkMailerLite } = require('../Controllers/healthController');
const { adminProtect } = require('../middleware/authAdmin');

// GET /api/health/mailerlite
router.get('/mailerlite', adminProtect, checkMailerLite);

module.exports = router;
