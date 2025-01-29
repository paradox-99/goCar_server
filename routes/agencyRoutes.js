const express = require('express');
const Router = express.Router();
const { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyDetails2 } = require('../controllers/agencyController')

Router.get('/getAllAgencyData', getAllAgency);
Router.get('/getAgencyDetails/:id', getAgencyDetails);
Router.get('/getAgencyDetails2/:id', getAgencyDetails2);
Router.get('/getAgencyOwner/:id', getAgencyOwner);
Router.get('/getAllBookings', getAllBookings);

module.exports = Router