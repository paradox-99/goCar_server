const express = require('express');
const Router = express.Router();
const { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyDetails2 } = require('../controllers/agencyController');
const { verifyToken, verifyAdmin, verifyAgency } = require('../config/jwt');

Router.get('/getAllAgencyData', verifyToken, verifyAdmin, getAllAgency);
Router.get('/getAgencyDetails/:id', getAgencyDetails);
Router.get('/getAgencyDetails2/:id', verifyToken, getAgencyDetails2);
Router.get('/getAgencyOwner/:id', verifyToken, getAgencyOwner);
Router.get('/getAllBookings', verifyToken, verifyAgency, getAllBookings);

module.exports = Router