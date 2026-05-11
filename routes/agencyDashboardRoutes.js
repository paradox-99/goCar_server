const express = require('express');
const Router = express.Router();
const { verifyToken, verifyAgency } = require('../config/jwt');
const {
    getAgencyDashboardStats,
    getRevenueTrend,
    getRecentBookings,
    getFleetStatus,
    getDriverStatus,
    getRecentDamage,
    getRecentReviews,
} = require('../controllers/agencyDashboardController');

Router.get('/stats/:agencyId',    verifyToken, verifyAgency, getAgencyDashboardStats);
Router.get('/revenue-trend/:agencyId', verifyToken, verifyAgency, getRevenueTrend);
Router.get('/bookings/:agencyId', verifyToken, verifyAgency, getRecentBookings);
Router.get('/fleet/:agencyId',    verifyToken, verifyAgency, getFleetStatus);
Router.get('/drivers/:agencyId',  verifyToken, verifyAgency, getDriverStatus);
Router.get('/damage/:agencyId',   verifyToken, verifyAgency, getRecentDamage);
Router.get('/reviews/:agencyId',  verifyToken, verifyAgency, getRecentReviews);

module.exports = Router;
