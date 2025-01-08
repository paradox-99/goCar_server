const express = require('express');
const { showCarByBrand } = require('../controllers/carControllers');
const Router = express.Router();

Router.get('/carByBrand/:brand', showCarByBrand)

module.exports = Router;