const express = require('express');
const Router = express.Router();
const { verifyToken, verifyAgency } = require('../config/jwt');
const { createReturn, getReturnByBookingId, confirmReturn } = require('../controllers/returnController');

// Agency submits return form (agency only)
Router.post('/create', verifyToken, verifyAgency, createReturn);

// Get return details for a booking (both agency and user)
Router.get('/booking/:bookingId', verifyToken, getReturnByBookingId);

// User confirms vehicle return
Router.patch('/confirm/:bookingId', verifyToken, confirmReturn);

module.exports = Router;
