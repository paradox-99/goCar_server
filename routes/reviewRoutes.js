const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { addVehicleReview, addDriverReview, addAgencyReview, getUserReviews, getReceivedReviews } = require('../controllers/reviewController');

Router.post('/vehicle', verifyToken, addVehicleReview);
Router.post('/driver', verifyToken, addDriverReview);
Router.post('/agency', verifyToken, addAgencyReview);

Router.get('/user/:userId', verifyToken, getUserReviews);
Router.get('/received/:targetType/:targetId', verifyToken, getReceivedReviews);

module.exports = Router;
