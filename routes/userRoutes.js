const express = require('express');
const Router = express.Router();
const { showAllUsers, getUserRole, getUser, getBookings, checkNID, checkPhone, createUser } = require('../controllers/userController');
const { verifyToken, verifyAdmin, verifyUser } = require('../config/jwt');

// Router.get('/users', verifyToken, verifyAdmin, showAllUsers)
Router.get('/users', showAllUsers)
Router.get('/getUserRole/:email', getUserRole)
Router.get('/getUserInfo/:email', getUser)
Router.get('/getBookings/:id', verifyToken, verifyAdmin, getBookings)
Router.get('/checkNID/:nid', checkNID)
Router.get('/checkPhone/:phone', checkPhone)
Router.post('/createUser', createUser)

module.exports = Router;