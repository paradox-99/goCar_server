const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { createPickup, createReturn, reportDamage, createUserDamageReport, getUserDamageReports, getAgencyDamageReports, updateDamageStatus } = require('../controllers/returnDamageController');

Router.post('/pickup', verifyToken, createPickup);
Router.post('/return', verifyToken, createReturn);
Router.post('/damage', verifyToken, reportDamage);
Router.post('/user-damage', verifyToken, createUserDamageReport);
Router.get('/user-reports/:userId', verifyToken, getUserDamageReports);
Router.get('/agency-reports/:agencyId', verifyToken, getAgencyDamageReports);
Router.patch('/damage-status/:damageId', verifyToken, updateDamageStatus);

module.exports = Router;
