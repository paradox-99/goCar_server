const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const ratelimit = require('express-rate-limit');

const userRoutes = require('./routes/userRoutes');
const carRoutes = require('./routes/carRoutes');
const bikeRoutes = require('./routes/bikeRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const authorizationRoutes = require('./routes/authorization');
const bookingRoutes = require('./routes/bookingRoutes');
const addressRoutes = require('./routes/addressRoutes');

// Error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({
    origin: [
        'http://localhost:5173',
    ],
    credentials: true
}));

// rate limiting
const limiter = ratelimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again after some time.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json());
app.use(limiter);
app.use(cookieParser());

app.use('/api/userRoute', userRoutes);
app.use('/api/carRoutes', carRoutes);
app.use('/api/bikeRoutes', bikeRoutes);
app.use('/api/agencyRoutes', agencyRoutes);
app.use('/api/driverRoutes', driverRoutes);
app.use('/api/paymentRoutes', paymentRoutes);
app.use('/api/authorization', authorizationRoutes);
app.use('/api/bookingRoutes', bookingRoutes);
app.use('/api/addressRoutes', addressRoutes);

// Handle 404 - Route not found
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

module.exports = app;
