const express = require('express');
const {
     showCarByBrand, showCarByType, carsByQuery, carsByFilter, carDetails,
     showAllCars, showAgencyCars, agencyActiveBookingCars, getCarReviews,
     createCar, updateCarInfo,
     addFavourite, removeFavourite, clearAllFavourites, getUserFavourites, checkFavourite,
} = require('../controllers/carControllers');
const { verifyToken } = require('../config/jwt');
const Router = express.Router();

Router.get('/carByBrand/:brand', showCarByBrand);
Router.get('/carByType/:type', showCarByType);
Router.get('/getSearchData', carsByQuery);
Router.get('/getCarByLocation', carsByFilter);
Router.get('/getCarDetails/:id', carDetails);
Router.get('/getCarReviews/:id', getCarReviews);
Router.get('/showAllCars', showAllCars);
Router.get('/showAgencyCars/:id', showAgencyCars);
Router.get('/agencyActiveBookingCars/:id', agencyActiveBookingCars);
Router.post('/addCar', createCar);
Router.patch('/updateCarInfo/:id', updateCarInfo);

// ── Favourites ────────────────────────────────────────────────
Router.post('/addFavourite', verifyToken, addFavourite);
Router.delete('/removeFavourite', verifyToken, removeFavourite);
Router.delete('/clearFavourites/:userId', verifyToken, clearAllFavourites);
Router.get('/getFavourites/:userId', verifyToken, getUserFavourites);
Router.get('/checkFavourite/:userId/:carId', verifyToken, checkFavourite);

module.exports = Router;