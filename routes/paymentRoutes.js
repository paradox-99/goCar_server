const express = require('express');
const Router = express.Router();
const { makePayment, paymentSuccess, getPaymentInfo, paymentFail, getPaymentHistory } = require('../controllers/paymentController');
const { verifyToken, verifyAdmin } = require('../config/jwt');

Router.post('/payment', makePayment);
Router.post('/payment/success/:trx_id', paymentSuccess);
Router.get('/getPaymentInfo/:tran_id', getPaymentInfo);
Router.post('/paymentFail/:tran_id', paymentFail);
Router.get('/paymentHistory', verifyToken, verifyAdmin, getPaymentHistory);

module.exports = Router;