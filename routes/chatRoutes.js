const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { listMessages, sendMessage } = require('../controllers/chatController');

Router.get('/:bookingId', verifyToken, listMessages);
Router.post('/', verifyToken, sendMessage);

module.exports = Router;
