const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { listNotifications, createNotification, markAsRead, getUnreadCount, listAllNotifications } = require('../controllers/notificationController');
const { verifyAdmin } = require('../config/jwt'); // Added this to verify admin

const { 
    getAdminNotificationStats, 
    getAdminNotificationsList, 
    sendAdminNotification, 
    deleteAdminNotifications, 
    getAdminNotificationAnalytics,
    searchRecipients
} = require('../controllers/adminNotificationController');

Router.get('/user/:userId', verifyToken, listNotifications);
Router.get('/unread/:userId', verifyToken, getUnreadCount);
Router.get('/all', verifyToken, verifyAdmin, listAllNotifications);
Router.post('/', verifyToken, createNotification);
Router.patch('/:notifId/read', verifyToken, markAsRead);

// Admin Routes
Router.get('/admin/stats', verifyToken, verifyAdmin, getAdminNotificationStats);
Router.get('/admin/list', verifyToken, verifyAdmin, getAdminNotificationsList);
Router.post('/admin/send', verifyToken, verifyAdmin, sendAdminNotification);
Router.post('/admin/delete-bulk', verifyToken, verifyAdmin, deleteAdminNotifications);
Router.get('/admin/analytics', verifyToken, verifyAdmin, getAdminNotificationAnalytics);
Router.get('/admin/search-recipients', verifyToken, verifyAdmin, searchRecipients);

module.exports = Router;
