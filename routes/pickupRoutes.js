const express = require('express');
const Router = express.Router();
const { verifyToken, verifyAgency } = require('../config/jwt');
const { createPickup, getPickupByBookingId, confirmPickup } = require('../controllers/pickupController');

// Agency initiates pickup (agency only)
Router.post('/create', verifyToken, verifyAgency, createPickup);

// Get pickup details for a booking (both agency and user)
Router.get('/booking/:bookingId', verifyToken, getPickupByBookingId);

// User confirms pickup receipt
Router.patch('/confirm/:bookingId', verifyToken, confirmPickup);

module.exports = Router;
