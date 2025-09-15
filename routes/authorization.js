const express = require('express');
const { generateToken, removeToken } = require('../config/jwt');
const Router = express.Router();
const connectDB = require('../config/db');

Router.post("/jwt", async (req, res) => {
    const { email } = req.body;

    const query = `
        SELECT _id AS id, userRole, email
        FROM users
        WHERE email = ?
        UNION
        SELECT _id AS id, 'driver' AS userRole, email
        FROM drivers
        WHERE email = ? `;

    connectDB.query(query, [email, email], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Server error" });
        }

        if (results.length !== 0) {
            const token = generateToken(results[0]);
            console.log("token genareted:", token);

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== "development" ? true : false,
                sameSite: process.env.NODE_ENV !== "development" ? "None" : "Lax",
                maxAge: 15 * 24 * 60 * 60 * 1000
            })
                .send({ success: true });
        }
        else {
            res.json({ message: "User not found" });
        }
    });
})

Router.post("/logout", (req, res) => {
    console.log("logout route");

    res.clearCookie('accessToken', {
        maxAge: 0,
    }).send({ success: true, message: 'Logged out successfully' });
})

module.exports = Router;