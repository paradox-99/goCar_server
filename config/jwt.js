const connectDB = require('../config/db');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const jwtSecret = process.env.ACCESS_TOKEN_SECRET;

const generateToken = (user, res) => {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.userrole },
        jwtSecret,
        { expiresIn: '15d' }
    );

    return accessToken;
};


const verifyToken = async (req, res, next) => {
    const token = req.cookies?.accessToken;

    if (!token)
        return res.status(401).send({ message: "Unauthorized" })
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err)
            return res.status(403).send({ message: "Forbidden access" })

        req.user = decode
        next();
    })
}

const verifyRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const email = req.user?.email;
            const roleFromToken = req.user?.role;

            if (!email) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            let role = roleFromToken;
            if (!role) {
                const userResult = await connectDB.query(
                    'SELECT userrole FROM users WHERE email = $1',
                    [email]
                );

                if (userResult.rowCount > 0) {
                    role = userResult.rows[0].userrole;
                } else {
                    const driverResult = await connectDB.query(
                        "SELECT 'driver' AS userrole FROM driver_info WHERE email = $1",
                        [email]
                    );
                    if (driverResult.rowCount > 0) {
                        role = 'driver';
                    }
                }
            }

            if (!role || !allowedRoles.includes(role)) {
                return res.status(403).json({ message: 'Forbidden access' });
            }

            req.user.role = role;
            next();
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };
};

const verifyUser = verifyRole(['user']);
const verifyAgency = verifyRole(['agency']);
const verifyDriver = verifyRole(['driver']);
const verifyAdmin = verifyRole(['admin']);

module.exports = { generateToken, verifyToken, verifyUser, verifyAgency, verifyDriver, verifyAdmin };