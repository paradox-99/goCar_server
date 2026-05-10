const express = require('express');
const router = express.Router();
const adminSettingsController = require('../controllers/adminSettingsController');
const { verifyToken, verifyAdmin } = require('../config/jwt'); 

// Apply auth and admin check to all routes
router.use(verifyToken);
router.use(verifyAdmin);

router.get('/profile', adminSettingsController.getAdminProfile);
router.put('/profile', adminSettingsController.updateAdminProfile);
router.put('/password', adminSettingsController.updatePassword);
router.put('/notification-preferences', adminSettingsController.updateNotificationPreferences);
router.get('/activity-log', adminSettingsController.getActivityLog);
router.get('/admins', adminSettingsController.getAdmins);
router.put('/admins/:id', adminSettingsController.updateAdminRole);
router.get('/platform', adminSettingsController.getPlatformSettings);
router.put('/platform', adminSettingsController.updatePlatformSettings);

module.exports = router;
