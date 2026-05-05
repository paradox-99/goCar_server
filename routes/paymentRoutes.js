const express = require('express');
const Router = express.Router();
const { 
    makePayment, 
    makeExistingBookingPayment, 
    paymentSuccess, 
    getPaymentInfo, 
    paymentFail, 
    getPaymentHistory,
    getAdminFilteredPayments,
    getAdminPaymentStats,
    getAdminPaymentDetails,
    getAdminRevenueAnalytics
} = require('../controllers/paymentController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

Router.post('/payment', verifyToken, makePayment);
Router.post('/existing-payment', verifyToken, makeExistingBookingPayment);
Router.post('/payment/success/:trx_id', paymentSuccess);
Router.get('/getPaymentInfo/:tran_id', verifyToken, getPaymentInfo);
Router.post('/paymentFail/:tran_id', paymentFail);
Router.get('/paymentHistory', verifyToken, verifyAdmin, getPaymentHistory);

// Admin Routes
Router.get('/admin/filtered', verifyToken, verifyAdmin, getAdminFilteredPayments);
Router.get('/admin/stats', verifyToken, verifyAdmin, getAdminPaymentStats);
Router.get('/admin/details/:id', verifyToken, verifyAdmin, getAdminPaymentDetails);
Router.get('/admin/analytics', verifyToken, verifyAdmin, getAdminRevenueAnalytics);

module.exports = Router;