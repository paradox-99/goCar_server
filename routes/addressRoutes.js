const express = require('express');
const Router = express.Router();
const {
     updateAddressById,
     getAddressById
} = require('../controllers/addressController');
// const { verifyToken } = require('../config/jwt');


Router.get('/:addressId', getAddressById);
Router.patch('/updateAddress/:addressId', updateAddressById);

module.exports = Router;
