const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { listNotifications, createNotification, markAsRead } = require('../controllers/notificationController');

Router.get('/user/:userId', verifyToken, listNotifications);
Router.post('/', verifyToken, createNotification);
Router.patch('/:notifId/read', verifyToken, markAsRead);

module.exports = Router;
