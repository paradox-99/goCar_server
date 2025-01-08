const express = require('express');
const Router = express.Router();
const { showAllUsers, getUserRole } = require('../controllers/userController');

Router.get('/users', showAllUsers)
Router.get('/getUserRole/:email', getUserRole)

module.exports = Router;