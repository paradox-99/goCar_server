const express = require('express');
const Router = express.Router();
const { showAllDrivers, checkNID, checkPhone, checkLicense, createDriver, getDriverProfile, updateDriverAvailability, verifyDriverAccount } = require('../controllers/drivercontroller');
const { verifyToken, verifyAdmin, verifyDriver } = require('../config/jwt');

Router.get('/driverList', showAllDrivers);
Router.get('/checkNID/:nid', checkNID);
Router.get('/checkPhone/:phone', checkPhone);
Router.get('/checkLicense/:license_number', checkLicense);
Router.post('/createDriver', createDriver);
Router.get('/profile/:email', verifyToken, getDriverProfile);
Router.patch('/availability/:driverId', verifyToken, verifyDriver, updateDriverAvailability);
Router.patch('/verify/:driverId', verifyToken, verifyAdmin, verifyDriverAccount);

module.exports = Router;

