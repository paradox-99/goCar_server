const expresss = require('express');
const Router = expresss.Router();
const { createBooking, getUserBookings, getCarBookings } = require('../controllers/bookingController');
Router.post('/createBooking', createBooking);
Router.get('/getUserBookings/:id', getUserBookings);
Router.get('/getCarBookings/:id', getCarBookings);

module.exports = Router;