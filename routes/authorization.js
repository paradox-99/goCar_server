const express = require('express');
const { generateToken } = require('../config/jwt');
const Router = express.Router();
const pool = require('../config/db');

Router.post("/jwt", async (req, res) => {
    const { email } = req.body;

    const query = `
        SELECT _id AS id, userRole, email
        FROM users
        WHERE email = $1
        UNION
        SELECT _id AS id, 'driver' AS userRole, email
        FROM drivers
        WHERE email = $2 `;

    try {
        const result = await pool.query(query, [email, email]);
        if (result.rowCount !== 0) {
            const token = generateToken(result.rows[0]);

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
    } catch (error) {
        res.status(500).send(error.message);
    }
})

Router.post("/logout", (req, res) => {
    res.clearCookie('accessToken', {
        maxAge: 0,
    }).send({ success: true, message: 'Logged out successfully' });
})

module.exports = Router;