const express = require('express');
const Router = express.Router();
const { showAllDrivers, checkNID, checkPhone, checkLicense, createDriver, getDriverProfile, updateDriverAvailability, verifyDriverAccount, getAgencyDriversByEmail, adminGetAllDrivers, getDriverProfileById, updateDriverInfoAdmin, suspendDriver, removeFromAgency } = require('../controllers/drivercontroller');
const { verifyToken, verifyAdmin, verifyDriver, verifyAgency } = require('../config/jwt');

Router.get('/admin-all-drivers', verifyToken, verifyAdmin, adminGetAllDrivers);
Router.get('/profile-by-id/:id', verifyToken, verifyAdmin, getDriverProfileById);
Router.get('/driverList', showAllDrivers);
Router.get('/checkNID/:nid', checkNID);
Router.get('/checkPhone/:phone', checkPhone);
Router.get('/checkLicense/:license_number', checkLicense);
Router.post('/createDriver', createDriver);
Router.get('/profile/:email', verifyToken, getDriverProfile);
Router.get('/agencyDrivers/:email', verifyToken, verifyAgency, getAgencyDriversByEmail);
Router.patch('/availability/:driverId', verifyToken, verifyDriver, updateDriverAvailability);
Router.patch('/verify/:driverId', verifyToken, verifyAdmin, verifyDriverAccount);
Router.patch('/updateDriverInfo/:driverId', verifyToken, verifyAdmin, updateDriverInfoAdmin);
Router.patch('/suspend/:driverId', verifyToken, verifyAgency, suspendDriver);
Router.patch('/remove-from-agency/:driverId', verifyToken, verifyAgency, removeFromAgency);

module.exports = Router;

