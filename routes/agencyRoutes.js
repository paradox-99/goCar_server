const express = require('express');
const Router = express.Router();
const { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings,getAgencyProfile, getAgencyCarsByOwner, updateAgencyOwnerInfo, updateAgencyInfo } = require('../controllers/agencyController');
const { verifyToken, verifyAdmin, verifyAgency } = require('../config/jwt');

Router.get('/getAllAgencyData', getAllAgency);
Router.get('/getAgencyDetails/:id', getAgencyDetails);
Router.get('/getAgencyOwner/:id', verifyToken, getAgencyOwner);
Router.get('/getAllBookings', verifyToken, verifyAgency, getAllBookings);
Router.get('/getAgencyProfile/:email', verifyToken, verifyAgency, getAgencyProfile);
Router.get('/getAgencyCarsByOwner/:email', verifyToken, verifyAgency, getAgencyCarsByOwner);

// Update agency owner information
Router.patch('/updateOwnerInfo/:id', verifyToken, verifyAgency, updateAgencyOwnerInfo);

// Update agency information
Router.patch('/updateAgencyInfo/:id', verifyToken, verifyAgency, updateAgencyInfo);

module.exports = Router