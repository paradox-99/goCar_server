const expresss = require('express');
const Router = expresss.Router();
const { createBooking, getUserBookings, getCarBookings, cancelBooking, updateBookingStatus, getDriverBookings, getBookingById } = require('../controllers/bookingController');
const { verifyToken } = require('../config/jwt');

Router.post('/createBooking', verifyToken, createBooking);
Router.get('/getUserBookings/:id', verifyToken, getUserBookings);
Router.get('/getBooking/:id', verifyToken, getBookingById);
Router.get('/getCarBookings/:id', verifyToken, getCarBookings);
Router.get('/getDriverBookings/:id', verifyToken, getDriverBookings);
Router.put('/cancelBooking/:id', verifyToken, cancelBooking);
Router.patch('/updateStatus/:id', verifyToken, updateBookingStatus);

module.exports = Router;