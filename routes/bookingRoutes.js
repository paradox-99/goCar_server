const expresss = require('express');
const Router = expresss.Router();
const { 
    createBooking, 
    getUserBookings, 
    getCarBookings, 
    cancelBooking, 
    updateBookingStatus, 
    getDriverBookings, 
    getBookingById, 
    checkAvailability,
    getAdminFilteredBookings,
    getAdminBookingStats,
    getAdminBookingDetails,
    updateAdminBooking
} = require('../controllers/bookingController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

Router.post('/createBooking', verifyToken, createBooking);
Router.post('/checkAvailability', verifyToken, checkAvailability);
Router.get('/getUserBookings/:id', verifyToken, getUserBookings);
Router.get('/getBooking/:id', verifyToken, getBookingById);
Router.get('/getCarBookings/:id', verifyToken, getCarBookings);
Router.get('/getDriverBookings/:id', verifyToken, getDriverBookings);
Router.put('/cancelBooking/:id', verifyToken, cancelBooking);
Router.patch('/updateStatus/:id', verifyToken, updateBookingStatus);

// Admin Routes
Router.get('/admin/filtered', verifyToken, verifyAdmin, getAdminFilteredBookings);
Router.get('/admin/stats', verifyToken, verifyAdmin, getAdminBookingStats);
Router.get('/admin/details/:id', verifyToken, verifyAdmin, getAdminBookingDetails);
Router.patch('/admin/update/:id', verifyToken, verifyAdmin, updateAdminBooking);

module.exports = Router;