const express = require('express');
const { showBikeByBrand, bikeDetails, getBikeReviews, showAllBikes } = require('../controllers/bikeControllers');
const Router = express.Router();

Router.get('/bikeByBrand/:brand', showBikeByBrand);
Router.get('/getBikeDetails/:id', bikeDetails);
Router.get('/getBikeReviews/:id', getBikeReviews);
Router.get('/showAllBikes', showAllBikes);

module.exports = Router;