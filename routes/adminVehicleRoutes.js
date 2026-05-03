const express = require('express');
const {
    adminGetAllCars,
    adminGetAllBikes,
    adminGetCarDetails,
    adminGetBikeDetails,
    adminUpdateCarStatus,
    adminUpdateBikeStatus
} = require('../controllers/adminVehicleControllers');
const { verifyToken, verifyAdmin } = require('../config/jwt');
const Router = express.Router();

Router.get('/cars', verifyToken, verifyAdmin, adminGetAllCars);
Router.get('/bikes', verifyToken, verifyAdmin, adminGetAllBikes);
Router.get('/car-details/:id', verifyToken, verifyAdmin, adminGetCarDetails);
Router.get('/bike-details/:id', verifyToken, verifyAdmin, adminGetBikeDetails);
Router.patch('/update-car/:id', verifyToken, verifyAdmin, adminUpdateCarStatus);
Router.patch('/update-bike/:id', verifyToken, verifyAdmin, adminUpdateBikeStatus);

module.exports = Router;
