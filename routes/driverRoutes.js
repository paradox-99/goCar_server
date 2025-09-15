const express = require('express');
const Router = express.Router();
const { showAllDrivers, checkNID, checkPhone, createDriver } = require('../controllers/drivercontroller');

Router.get('/driverList/:district', showAllDrivers);
Router.get('/checkNID/:nid', checkNID);
Router.get('/checkPhone/:phone', checkPhone);
Router.post('/createDriver', createDriver);

module.exports = Router;

