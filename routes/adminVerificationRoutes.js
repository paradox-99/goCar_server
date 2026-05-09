const express = require('express');
const { getVerificationStats, getVerificationList } = require('../controllers/adminVerificationController');
const { verifyToken, verifyAdmin } = require('../config/jwt');
const Router = express.Router();

Router.get('/stats', verifyToken, verifyAdmin, getVerificationStats);
Router.get('/list', verifyToken, verifyAdmin, getVerificationList);

module.exports = Router;
