const express = require('express');
const router = express.Router();
const { 
    getRevenueAnalytics, 
    getBookingAnalytics, 
    getCancellationAnalytics, 
    getDriverPerformance, 
    getAgencyPerformance, 
    getVehiclePerformance 
} = require('../controllers/adminAnalyticsController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

router.get('/revenue', verifyToken, verifyAdmin, getRevenueAnalytics);
router.get('/bookings', verifyToken, verifyAdmin, getBookingAnalytics);
router.get('/cancellations', verifyToken, verifyAdmin, getCancellationAnalytics);
router.get('/drivers', verifyToken, verifyAdmin, getDriverPerformance);
router.get('/agencies', verifyToken, verifyAdmin, getAgencyPerformance);
router.get('/vehicles', verifyToken, verifyAdmin, getVehiclePerformance);

module.exports = router;
