const expresss = require('express');
const Router = expresss.Router();
const { createBooking, getUserBookings, getCarBookings, cancelBooking, updateBookingStatus } = require('../controllers/bookingController');
const { verifyToken } = require('../config/jwt');

Router.post('/createBooking', verifyToken, createBooking);
Router.get('/getUserBookings/:id', verifyToken, getUserBookings);
Router.get('/getCarBookings/:id', verifyToken, getCarBookings);
Router.put('/cancelBooking/:id', verifyToken, cancelBooking);
Router.patch('/updateStatus/:id', verifyToken, updateBookingStatus);

module.exports = Router;