const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const carRoutes = require('./routes/carRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors({
    origin: [
        'http://localhost:5173',
    ],
    credentials: true
}
));
app.use(express.json());

app.use('/api/userRoute', userRoutes);
app.use('/api/carRoutes', carRoutes);
app.use('/api/agencyRoutes', agencyRoutes);
app.use('/api/driverRoutes', driverRoutes);
app.use('/api/paymentRoutes', paymentRoutes);

module.exports = app;
