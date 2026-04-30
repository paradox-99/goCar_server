const express = require('express');
const Router = express.Router();
const { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyProfile, getAgencyCarsByOwner, getAgencyBookingsByEmail, getAgencyBookingsByAgencyId, updateAgencyOwnerInfo, updateAgencyInfo, getAgencyByIdDetailed, getAdminStats } = require('../controllers/agencyController');
const { verifyToken, verifyAdmin, verifyAgency } = require('../config/jwt');

Router.get('/getAllAgency', getAllAgency);
Router.get('/admin-stats', verifyToken, verifyAdmin, getAdminStats);
Router.get('/agency-by-id-detailed/:id', verifyToken, verifyAdmin, getAgencyByIdDetailed);
Router.get('/getAgencyDetails/:id', verifyToken, getAgencyDetails);
Router.get('/getAgencyOwner/:id', verifyToken, getAgencyOwner);
Router.get('/getAllBookings', verifyToken, verifyAgency, getAllBookings);
Router.get('/getAgencyProfile/:email', verifyToken, verifyAgency, getAgencyProfile);
Router.get('/getAgencyCarsByOwner/:email', verifyToken, verifyAgency, getAgencyCarsByOwner);
Router.get('/getAgencyBookingsByEmail/:email', verifyToken, verifyAgency, getAgencyBookingsByEmail);
Router.get('/getBookingsByAgencyId/:agencyId', verifyToken, verifyAgency, getAgencyBookingsByAgencyId);

// Update agency owner information
Router.patch('/updateOwnerInfo/:id', verifyToken, verifyAgency, updateAgencyOwnerInfo);

// Update agency information
Router.patch('/updateAgencyInfo/:id', verifyToken, verifyAgency, updateAgencyInfo);

module.exports = Router