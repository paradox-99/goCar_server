const express = require('express');
const Router = express.Router();
const { verifyToken, verifyDriver } = require('../config/jwt');
const { getTripsStats, getTripsBanners, getTripsList, getTripDetail, getTripEarnings } = require('../controllers/driverTripsController');

Router.get('/stats/:driverId',    verifyToken, verifyDriver, getTripsStats);
Router.get('/banners/:driverId',  verifyToken, verifyDriver, getTripsBanners);
Router.get('/list/:driverId',     verifyToken, verifyDriver, getTripsList);
Router.get('/detail/:bookingId',  verifyToken, verifyDriver, getTripDetail);
Router.get('/earnings/:driverId', verifyToken, verifyDriver, getTripEarnings);

module.exports = Router;
