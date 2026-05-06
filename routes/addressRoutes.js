const express = require('express');
const Router = express.Router();
const {
     updateAddressById,
     getAddressById
} = require('../controllers/addressController');
const { verifyToken, verifyAdmin } = require('../config/jwt');
const { 
    getAdminAddressStats, 
    getAdminAddressList, 
    getAdminAddressMapData, 
    deleteAdminAddresses,
    getDistinctCities 
} = require('../controllers/adminAddressController');


Router.get('/:addressId', getAddressById);
Router.patch('/updateAddress/:addressId', updateAddressById);

// Admin routes
Router.get('/admin/stats', verifyToken, verifyAdmin, getAdminAddressStats);
Router.get('/admin/list', verifyToken, verifyAdmin, getAdminAddressList);
Router.get('/admin/map', verifyToken, verifyAdmin, getAdminAddressMapData);
Router.get('/admin/cities', verifyToken, verifyAdmin, getDistinctCities);
Router.post('/admin/delete-bulk', verifyToken, verifyAdmin, deleteAdminAddresses);

module.exports = Router;
