const express = require('express');
const router = express.Router();
const adminDamageController = require('../controllers/adminDamageController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

router.use(verifyToken);
router.use(verifyAdmin);

router.get('/stats', adminDamageController.getDamageStats);
router.get('/list', adminDamageController.getDamageReports);
router.get('/detail/:id', adminDamageController.getDamageDetail);
router.put('/update/:id', adminDamageController.updateDamageStatus);
router.get('/analytics', adminDamageController.getDamageAnalytics);

module.exports = router;
