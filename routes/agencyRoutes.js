const express = require('express');
const Router = express.Router();
const { getAllAgency } = require('../controllers/agencyController')

Router.get('/getAllAgencyData', getAllAgency);

module.exports = Router