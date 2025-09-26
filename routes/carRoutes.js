const express = require('express');
const { showCarByBrand, showCarByType, carsByQuery, carsByFilter, cartCars, showAllCars, showAgencyCars, agencyActiveBookingCars } = require('../controllers/carControllers');
const Router = express.Router();

Router.get('/carByBrand/:brand', showCarByBrand);
Router.get('/carByType/:type', showCarByType);
Router.get('/getSearchData', carsByQuery); 
Router.get('/getCarByLocation', carsByFilter);
Router.get('/getCartCars', cartCars);
Router.get('/showAllCars', showAllCars);
Router.get('/showAgencyCars/:id', showAgencyCars);
Router.get('/agencyActiveBookingCars/:id', agencyActiveBookingCars);

module.exports = Router;