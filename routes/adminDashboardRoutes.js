const express = require('express');
const Router = express.Router();
const { verifyToken, verifyAdmin } = require('../config/jwt');
const {
    getAdminInfo,
    getStats,
    getRevenueChart,
    getRecentBookings,
    getRecentDamage,
    getRecentNotifications,
    getUpcomingBookings,
    getTopPerformers,
    getRevenueByMethod,
    globalSearch,
    getCalendarData,
} = require('../controllers/adminDashboardController');

Router.get('/admin-info',          verifyToken, verifyAdmin, getAdminInfo);
Router.get('/stats',               verifyToken, verifyAdmin, getStats);
Router.get('/revenue-chart',       verifyToken, verifyAdmin, getRevenueChart);
Router.get('/recent-bookings',     verifyToken, verifyAdmin, getRecentBookings);
Router.get('/recent-damage',       verifyToken, verifyAdmin, getRecentDamage);
Router.get('/recent-notifications',verifyToken, verifyAdmin, getRecentNotifications);
Router.get('/upcoming-bookings',   verifyToken, verifyAdmin, getUpcomingBookings);
Router.get('/top-performers',      verifyToken, verifyAdmin, getTopPerformers);
Router.get('/revenue-by-method',   verifyToken, verifyAdmin, getRevenueByMethod);
Router.get('/search',              verifyToken, verifyAdmin, globalSearch);
Router.get('/calendar',            verifyToken, verifyAdmin, getCalendarData);

module.exports = Router;
