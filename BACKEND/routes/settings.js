const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAdmin, requireRole, authenticate } = require('../middleware/auth');

router.get('/public', authenticate, settingsController.getPublicSettings);
router.get('/', requireAdmin, settingsController.getSettings);
router.get('/:key', requireAdmin, settingsController.getSetting);
router.put('/:key', requireAdmin, requireRole(['owner', 'admin']), settingsController.updateSetting);
router.post('/bulk', requireAdmin, requireRole(['owner']), settingsController.updateBulkSettings);

module.exports = router;
