const express = require('express');
const Router = express.Router();
const { 
     getAllAgency, 
     getAgencyDetails, 
     getAgencyOwner, 
     getAllBookings, 
     getAgencyDetails2, 
     getAgencyProfile, 
     getAgencyCarsByOwner,
     updateAgencyOwnerInfo,
     updateAgencyInfo
} = require('../controllers/agencyController');
// const { verifyToken, verifyAdmin, verifyAgency } = require('../config/jwt');

Router.get('/getAllAgencyData', getAllAgency);
Router.get('/getAgencyDetails/:id', getAgencyDetails);
Router.get('/getAgencyDetails2/:id', getAgencyDetails2);
Router.get('/getAgencyOwner/:id', getAgencyOwner);
Router.get('/getAllBookings', getAllBookings);
// Router.get('/getAllAgencyData', verifyToken, verifyAdmin, getAllAgency);
// Router.get('/getAgencyDetails/:id', getAgencyDetails);
// Router.get('/getAgencyDetails2/:id', verifyToken, getAgencyDetails2);
// Router.get('/getAgencyOwner/:id', verifyToken, getAgencyOwner);
// Router.get('/getAllBookings', verifyToken, verifyAgency, getAllBookings);
Router.get('/getAgencyProfile/:email', getAgencyProfile);
Router.get('/getAgencyCarsByOwner/:email', getAgencyCarsByOwner);

// Update agency owner information
Router.patch('/updateOwnerInfo/:id', updateAgencyOwnerInfo);

// Update agency information
Router.patch('/updateAgencyInfo/:id', updateAgencyInfo);

module.exports = Router