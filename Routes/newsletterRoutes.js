const express = require('express');
const router = express.Router();
const { subscribe, getSubscribers } = require('../Controllers/newsletterController');
const { protect, authorize } = require('../middleware/auth'); 

// --- PUBLIC ROUTE ---
// @route   POST /api/v1/newsletter
router.post('/', subscribe);

// --- PROTECTED ADMIN ROUTE ---
// This route requires a logged-in Admin to view the list of subscribers
// @route   GET /api/v1/newsletter
router.get('/', protect, authorize('admin'), getSubscribers);

module.exports = router;