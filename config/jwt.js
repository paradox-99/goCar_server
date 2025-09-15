const connectDB = require('../config/db');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const jwtSecret = process.env.ACCESS_TOKEN_SECRET;

const generateToken = (user, res) => {
    const accessToken = jwt.sign({ id: user._id, email: user.email, role: user.userRole }, jwtSecret, { expiresIn: '15d' });

    return accessToken;
};


const verifyToken = async (req, res, next) => {
    const token = req.cookies?.accessToken;
    console.log("token from verify: ", token);

    if (!token)
        return res.status(401).send({ message: "Unauthorized" })
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err)
            return res.status(403).send({ message: "Forbidden access" })

        req.user = decode
        next();
    })
}

const verifyUser = async (req, res, next) => {
    const email = req.user.email;
    const query = `SELECT userRole FROM users WHERE email = ?`;

    connectDB.query(query, [email], (err, results) => {
        if (err) {
            console.log('fetching error: ', err);
            return res.status(500).json({ error: 'Failed to retrieve users' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isUser = results[0].userRole === 'user';
        if (!isUser) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        next();
    })
    next();
}

const verifyAgency = async (req, res, next) => {
    const email = req.user.email;
    const query = `SELECT userRole FROM users WHERE email = ?`;

    connectDB.query(query, [email], (err, results) => {
        if (err) {
            console.log('fetching error: ', err);
            return res.status(500).json({ error: 'Failed to retrieve users' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isUser = results[0].userRole === 'agency';
        if (!isUser) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        next();
    })
    next();
}

const verifyDriver = async (req, res, next) => {
    const email = req.user.email;
    const query = `SELECT userRole FROM users WHERE email = ?`;

    connectDB.query(query, [email], (err, results) => {
        if (err) {
            console.log('fetching error: ', err);
            return res.status(500).json({ error: 'Failed to retrieve users' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isUser = results[0].userRole === 'user';
        if (!isUser) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        next();
    })
    next();
}

const verifyAdmin = async (req, res, next) => {
    const email = req.user.email;
    const query = `SELECT userRole FROM users WHERE email = ?`;

    connectDB.query(query, [email], (err, results) => {
        if (err) {
            console.log('fetching error: ', err);
            return res.status(500).json({ error: 'Failed to retrieve users' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isUser = results[0].userRole === 'admin';
        if (!isUser) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        next();
    })
    next();
}

module.exports = { generateToken, verifyToken, verifyUser, verifyAgency, verifyDriver, verifyAdmin };