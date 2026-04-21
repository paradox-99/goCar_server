const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { listNotifications, createNotification, markAsRead, getUnreadCount, listAllNotifications } = require('../controllers/notificationController');
const { verifyAdmin } = require('../config/jwt'); // Added this to verify admin

Router.get('/user/:userId', verifyToken, listNotifications);
Router.get('/unread/:userId', verifyToken, getUnreadCount);
Router.get('/all', verifyToken, verifyAdmin, listAllNotifications);
Router.post('/', verifyToken, createNotification);
Router.patch('/:notifId/read', verifyToken, markAsRead);

module.exports = Router;
