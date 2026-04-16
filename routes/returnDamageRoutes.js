const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { createPickup, createReturn, reportDamage } = require('../controllers/returnDamageController');

Router.post('/pickup', verifyToken, createPickup);
Router.post('/return', verifyToken, createReturn);
Router.post('/damage', verifyToken, reportDamage);

module.exports = Router;
