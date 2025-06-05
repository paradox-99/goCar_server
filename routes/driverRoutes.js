const express = require('express');
const Router = express.Router();
const { showAllDrivers } = require('../controllers/drivercontroller');

Router.get('/driverList/:district', showAllDrivers);

module.exports = Router;

