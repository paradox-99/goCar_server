const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');

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

module.exports = app;
