const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { addVehicleReview, addDriverReview, addAgencyReview, getUserReviews, getReceivedReviews } = require('../controllers/reviewController');
const { getAdminReviewStats, getAdminReviewsList, deleteAdminReview, getAdminReviewAnalytics } = require('../controllers/adminReviewController');


Router.post('/vehicle', verifyToken, addVehicleReview);
Router.post('/driver', verifyToken, addDriverReview);
Router.post('/agency', verifyToken, addAgencyReview);

Router.get('/user/:userId', verifyToken, getUserReviews);
Router.get('/received/:targetType/:targetId', verifyToken, getReceivedReviews);

// Admin Routes
Router.get('/admin/stats', verifyToken, getAdminReviewStats);
Router.get('/admin/list', verifyToken, getAdminReviewsList);
Router.delete('/admin/:type/:reviewId', verifyToken, deleteAdminReview);
Router.get('/admin/analytics', verifyToken, getAdminReviewAnalytics);


module.exports = Router;
