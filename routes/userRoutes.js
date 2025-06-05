const express = require('express');
const Router = express.Router();
const { showAllUsers, getUserRole, getUser, getBookings } = require('../controllers/userController');

Router.get('/users', showAllUsers)
Router.get('/getUserRole/:email', getUserRole)
Router.get('/getUserInfo/:email', getUser)
Router.get('/getBookings/:id', getBookings)

module.exports = Router;