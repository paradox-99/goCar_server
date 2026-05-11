const express = require('express');
const Router = express.Router();
const { verifyToken, verifyDriver } = require('../config/jwt');
const {
    getDriverFullProfile,
    getDriverReviews,
    updatePersonalInfo,
    updateAddress,
    updateLicensePro,
    updatePhoto,
    deactivateAccount,
} = require('../controllers/driverProfileController');

Router.get('/full/:email',            verifyToken, verifyDriver, getDriverFullProfile);
Router.get('/reviews/:driverId',      verifyToken, verifyDriver, getDriverReviews);
Router.patch('/personal/:driverId',   verifyToken, verifyDriver, updatePersonalInfo);
Router.patch('/address/:driverId',    verifyToken, verifyDriver, updateAddress);
Router.patch('/license/:driverId',    verifyToken, verifyDriver, updateLicensePro);
Router.patch('/photo/:driverId',      verifyToken, verifyDriver, updatePhoto);
Router.patch('/deactivate/:driverId', verifyToken, verifyDriver, deactivateAccount);

module.exports = Router;
