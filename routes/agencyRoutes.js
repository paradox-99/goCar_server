const express = require('express');
const Router = express.Router();
const {
    getAllAgency,
    getAgencyDetails,
    getAgencyOwner,
    getAllBookings,
    getAgencyProfile,
    getAgencyCarsByOwner,
    getAgencyBookingsByEmail,
    getAgencyBookingsByAgencyId,
    updateAgencyOwnerInfo,
    updateAgencyInfo,
    getAgencyByIdDetailed,
    getAdminStats,
    getFilteredAgencies,
    getAgencyAdminDetails,
    updateAgencyAdminStatus,
    getAgencyCities
} = require('../controllers/agencyController');
const {
    getAgencyReviewStats,
    getAgencyVehicleReviews,
    getAgencyVehicleSummary,
    getAgencyReviews,
    getAgencyDriverReviews,
    getAgencyDriverSummary
} = require('../controllers/agencyReviewController');
const { verifyToken, verifyAdmin, verifyAgency } = require('../config/jwt');

Router.get('/getAllAgency', getAllAgency);
Router.get('/admin-stats', verifyToken, verifyAdmin, getAdminStats);
Router.get('/agency-by-id-detailed/:id', verifyToken, verifyAdmin, getAgencyByIdDetailed);
Router.get('/getAgencyDetails/:id', verifyToken, getAgencyDetails);

// Admin Agency Management
Router.get('/admin/filtered', verifyToken, verifyAdmin, getFilteredAgencies);
Router.get('/admin/details/:agencyId', verifyToken, verifyAdmin, getAgencyAdminDetails);
Router.patch('/admin/update/:agencyId', verifyToken, verifyAdmin, updateAgencyAdminStatus);
Router.get('/admin/cities', verifyToken, verifyAdmin, getAgencyCities);

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

// Agency Review Dashboard Routes
Router.get('/reviews/stats/:agencyId', verifyToken, verifyAgency, getAgencyReviewStats);
Router.get('/reviews/vehicles/:agencyId', verifyToken, verifyAgency, getAgencyVehicleReviews);
Router.get('/reviews/vehicle-summary/:agencyId', verifyToken, verifyAgency, getAgencyVehicleSummary);
Router.get('/reviews/agency/:agencyId', verifyToken, verifyAgency, getAgencyReviews);
Router.get('/reviews/drivers/:agencyId', verifyToken, verifyAgency, getAgencyDriverReviews);
Router.get('/reviews/driver-summary/:agencyId', verifyToken, verifyAgency, getAgencyDriverSummary);

module.exports = Router