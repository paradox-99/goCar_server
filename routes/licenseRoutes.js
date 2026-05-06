const express = require('express');
const Router = express.Router();
const {
    getAdminLicenseStats,
    getAdminLicenseList,
    updateLicenseStatus,
    bulkUpdateLicenseStatus,
    getLicenseAnalytics
} = require('../controllers/adminLicenseController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

// Admin License Routes
Router.get('/admin/stats', verifyToken, verifyAdmin, getAdminLicenseStats);
Router.get('/admin/list', verifyToken, verifyAdmin, getAdminLicenseList);
Router.patch('/admin/update', verifyToken, verifyAdmin, updateLicenseStatus);
Router.patch('/admin/bulk-update', verifyToken, verifyAdmin, bulkUpdateLicenseStatus);
Router.get('/admin/analytics', verifyToken, verifyAdmin, getLicenseAnalytics);

module.exports = Router;
