const express = require('express');
const Router = express.Router();
const { showAllDrivers, checkNID, checkPhone, checkLicense, createDriver } = require('../controllers/drivercontroller');

Router.get('/driverList/:district', showAllDrivers);
Router.get('/checkNID/:nid', checkNID);
Router.get('/checkPhone/:phone', checkPhone);
Router.get('/checkLicense/:license_number', checkLicense);
Router.post('/createDriver', createDriver);

module.exports = Router;

