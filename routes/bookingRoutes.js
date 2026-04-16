const expresss = require('express');
const Router = expresss.Router();
const { createBooking, getUserBookings, getCarBookings, cancelBooking } = require('../controllers/bookingController');
const { verifyToken } = require('../config/jwt');

Router.post('/createBooking', verifyToken, createBooking);
Router.get('/getUserBookings/:id', verifyToken, getUserBookings);
Router.get('/getCarBookings/:id', verifyToken, getCarBookings);
Router.put('/cancelBooking/:id', verifyToken, cancelBooking);

module.exports = Router;