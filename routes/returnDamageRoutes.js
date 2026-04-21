const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { createPickup, createReturn, reportDamage, getUserDamageReports } = require('../controllers/returnDamageController');

Router.post('/pickup', verifyToken, createPickup);
Router.post('/return', verifyToken, createReturn);
Router.post('/damage', verifyToken, reportDamage);
Router.get('/user-reports/:userId', verifyToken, getUserDamageReports);

module.exports = Router;
