const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { addVehicleReview, addDriverReview, addAgencyReview } = require('../controllers/reviewController');

Router.post('/vehicle', verifyToken, addVehicleReview);
Router.post('/driver', verifyToken, addDriverReview);
Router.post('/agency', verifyToken, addAgencyReview);

module.exports = Router;
