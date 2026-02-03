const express = require('express');
const router = express.Router();

const { checkMailerLite } = require('../Controllers/healthController');

// GET /api/health/mailerlite
router.get('/mailerlite', checkMailerLite);

module.exports = router;
