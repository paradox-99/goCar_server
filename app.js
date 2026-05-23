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
const notificationRoutes = require('./routes/notificationRoutes');
const returnDamageRoutes = require('./routes/returnDamageRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminVehicleRoutes = require('./routes/adminVehicleRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const adminVerificationRoutes = require('./routes/adminVerificationRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');

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
app.use('/api/notificationRoutes', notificationRoutes);
app.use('/api/returnDamageRoutes', returnDamageRoutes);
app.use('/api/reviewRoutes', reviewRoutes);
app.use('/api/chatRoutes', chatRoutes);
app.use('/api/adminVehicleRoutes', adminVehicleRoutes);
app.use('/api/licenseRoutes', licenseRoutes);
app.use('/api/verification', adminVerificationRoutes);
app.use('/api/admin-analytics', require('./routes/adminAnalyticsRoutes'));
app.use('/api/admin-settings', require('./routes/adminSettingsRoutes'));
app.use('/api/admin-damage', require('./routes/adminDamageRoutes'));
app.use('/api/agencyDamage', require('./routes/agencyDamageRoutes'));
app.use('/api/agencyDashboard', require('./routes/agencyDashboardRoutes'));
app.use('/api/admin-dashboard', require('./routes/adminDashboardRoutes'));
app.use('/api/driverProfile', require('./routes/driverProfileRoutes'));
app.use('/api/driverTrips',   require('./routes/driverTripsRoutes'));
app.use('/api/pickupRoutes', require('./routes/pickupRoutes'));

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
