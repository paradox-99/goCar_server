const expresss = require('express');
const Router = expresss.Router();
const { createBooking, getUserBookings, getCarBookings, cancelBooking } = require('../controllers/bookingController');
Router.post('/createBooking', createBooking);
Router.get('/getUserBookings/:id', getUserBookings);
Router.get('/getCarBookings/:id', getCarBookings);
Router.put('/cancelBooking/:id', cancelBooking);

module.exports = Router;