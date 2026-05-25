const express = require('express');
const Router = express.Router();
const { verifyToken } = require('../config/jwt');
const { getPresignedUrls, uploadFile } = require('../controllers/uploadController');

// Authenticated users request presigned PUT URLs (kept for reference)
Router.post('/presign', verifyToken, getPresignedUrls);

// Server-proxied upload: browser sends raw binary → server signs & PUTs to S3
// express.raw() parses the request body as a Buffer regardless of Content-Type
Router.post(
    '/upload',
    verifyToken,
    express.raw({ type: '*/*', limit: '10mb' }),
    uploadFile
);

module.exports = Router;
