const express = require('express');
const Router = express.Router();
const { showAllUsers, getUserRole, getUser, getBookings, checkNID, checkPhone, createUser, updateUserInfo, updateUserAddress } = require('../controllers/userController');
const { verifyToken, verifyAdmin, verifyUser } = require('../config/jwt');

Router.get('/users', verifyToken, verifyAdmin, showAllUsers)
Router.get('/getUserRole/:email', getUserRole)
Router.get('/getUserInfo/:email', verifyToken, getUser)
Router.get('/getBookings/:id', verifyToken, verifyAdmin, getBookings)
Router.get('/checkNID/:nid', checkNID)
Router.get('/checkPhone/:phone', checkPhone)
Router.post('/createUser', createUser)

// Update user information (name, profile photo, gender, phone, license_number, expire_date, experience)
Router.patch('/updateUserInfo/:userId', verifyToken, updateUserInfo)

// Update user address information (city, area, postcode, display_name)
Router.patch('/updateUserAddress/:userId', verifyToken, updateUserAddress)

module.exports = Router;