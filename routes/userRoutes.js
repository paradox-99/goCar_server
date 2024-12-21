const express = require('express');
const { showAllUsers } = require('../controllers/userController');
const Router = express.Router();

Router.get('/users', showAllUsers)

module.exports = Router;