const pool = require('../config/db');
const { createUserId, createAddressId } = require('./createIDs');
const userService = require('../services/userService');
const userValidator = require('../validators/userValidator');
const asyncHandler = require('../utils/asyncHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

const showAllUsers = async (req, res) => {

     const query = "SELECT * FROM users JOIN address ON users.address_id = address.address_id";

     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const getUserRole = async (req, res) => {
     const email = req.params.email;
     const query = `
          SELECT user_id, name, userrole, photo
          FROM users
          WHERE email = $1`

     const query2 = `
          SELECT driver_id AS user_id, name, 'driver' AS userrole, photo
          FROM driver_info
          WHERE email = $1
     `

     try {
          const result = await pool.query(query, [email]);
          if (result.rowCount === 0) {
               const result2 = await pool.query(query2, [email]);
               return res.json(result2.rows);
          }
          
          res.json(result.rows);
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const getUser = async (req, res) => {
     const email = req.params.email;
     if (req.user?.email !== email && req.user?.role !== 'admin') {
          return res.status(403).json({ error: 'Forbidden access' });
     }

     const query = `
          SELECT users.*, address.*
          FROM users
          JOIN address ON users.address_id = address.address_id
          WHERE users.email = $1
     `

     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getBookings = async (req, res) => {
     const id = req.params.id

     const query = `
          SELECT *
          FROM booking_info
          JOIN cars ON booking_info.vehicle_id = cars.car_id
          WHERE user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const checkNID = async (req, res) => {
     const nid = req.params.nid;
     
     const query = `
          SELECT user_id AS id
          FROM users
          WHERE nid = $1
          UNION
          SELECT driver_id AS id
          FROM driver_info
          WHERE nid = $2 
     `

     try {
          const result = await pool.query(query, [nid, nid]);
          
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'NID not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'NID found', code: 1 });
          }
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const checkPhone = async (req, res) => {
     const phone = req.params.phone;

     const query = `
          SELECT user_id AS id
          FROM users
          WHERE phone = $1
          UNION
          SELECT driver_id AS id
          FROM driver_info
          WHERE phone = $2
     `

     try {
          const result = await pool.query(query, [phone, phone]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'Phone not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'Phone found', code: 1 });
          }
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const createUser = async (req, res) => {
     const { address, area, name, email, phone, gender, nid, birthdate, profilePicture } = req.body;

     const userId = createUserId();
     const addressId = createAddressId();

     const userRole = "user"
     const verified = false
     const accountStatus = "active"
     const license_number = null
     const license_status = "pending"
     const expire_date = null
     const experience = null

     const addressQuery = `
          INSERT INTO address (address_id, city, area, postcode, latitude, longitude, display_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
     `;

     try {
          const city = address?.district || address?.city || null;
          const locality = address?.upazilla || address?.area || area || null;
          const postcode = address?.postcode || null;
          const latitude = Number(address?.lat || address?.latitude || 0);
          const longitude = Number(address?.lon || address?.longitude || 0);
          const displayName = address?.display_name || locality || city || 'Unknown';
          const result = await pool.query(addressQuery, [addressId, city, locality, postcode, latitude, longitude, displayName]);

          if (result.rowCount === 1) {
               const userQuery = `
               INSERT INTO users (user_id, address_id, name, email, phone, gender, nid, dob, photo, userrole, verified, accountstatus, license_number, license_status, expire_date, experience)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               `;

               try {
                    const userResult = await pool.query(userQuery, [userId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, userRole, verified, accountStatus, license_number, license_status, expire_date, experience]);

                    if (userResult.rowCount === 1) {
                         return res.status(201).json({ message: 'User account created successfully', code: 1 });
                    } else {
                         return res.status(500).json({ error: 'Failed to create user account.', code: 0 });
                    }
               } catch (error) {
                    res.status(500).send(error.message);
               }
          }
          else {
               return res.status(200).json({ message: 'Failed To Create user account.', code: 0 });
          }
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const updateUserInfo = asyncHandler(async (req, res) => {
     const userId = userValidator.validateUserId(req.params.userId);
     const validatedData = userValidator.validateUpdateUserInfo(req.body);
     
     const updatedUser = await userService.updateUserInfo(userId, validatedData);
     
     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'User information updated successfully',
          data: updatedUser
     });
});

const updateUserAddress = asyncHandler(async (req, res) => {
     const userId = userValidator.validateUserId(req.params.userId);
     const validatedData = userValidator.validateUpdateUserAddress(req.body);
     
     const updatedAddress = await userService.updateUserAddress(userId, validatedData);
     
     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'User address updated successfully',
          data: updatedAddress
     });
});

const getUserById = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT users.*, address.*
          FROM users
          JOIN address ON users.address_id = address.address_id
          WHERE users.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          if (result.rowCount === 0) {
               return res.status(404).json({ message: 'User not found.' });
          }
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getDashboardStats = asyncHandler(async (req, res) => {
     const userId = req.params.userId;

     // 1. Total bookings
     const totalBookingsResult = await pool.query(
          `SELECT COUNT(*) AS total_bookings FROM booking_info WHERE user_id = $1`,
          [userId]
     );

     // 2. Active bookings
     const activeBookingsResult = await pool.query(
          `SELECT COUNT(*) AS active_bookings FROM booking_info
           WHERE user_id = $1 AND status IN ('Requested', 'Confirmed', 'Running')`,
          [userId]
     );

     // 3. Total spent
     const totalSpentResult = await pool.query(
          `SELECT COALESCE(SUM(total_cost), 0) AS total_spent FROM booking_info
           WHERE user_id = $1 AND status = 'Completed'`,
          [userId]
     );

     // 4. Favourite count (safe fallback if table doesn't exist)
     let favouriteCount = 0;
     try {
          const favResult = await pool.query(
               `SELECT COUNT(*) AS favourite_count FROM favourite_cars WHERE user_id = $1`,
               [userId]
          );
          favouriteCount = parseInt(favResult.rows[0]?.favourite_count || 0);
     } catch (_) {
          favouriteCount = 0;
     }

     // 5. Unread notifications
     const unreadResult = await pool.query(
          `SELECT COUNT(*) AS unread_notifications FROM notifications
           WHERE user_id = $1 AND is_read = false`,
          [userId]
     );

     // 6. Upcoming booking (Confirmed, start_ts in the future)
     const upcomingResult = await pool.query(
          `SELECT b.booking_id, c.brand, c.model, c.images[1] AS car_image,
                  b.start_ts, b.end_ts, b.status
           FROM booking_info b
           JOIN cars c ON b.vehicle_id = c.car_id
           WHERE b.user_id = $1
             AND b.status IN ('Confirmed')
             AND b.start_ts > NOW()
           ORDER BY b.start_ts ASC
           LIMIT 1`,
          [userId]
     );

     // 7. Most recent booking
     const recentResult = await pool.query(
          `SELECT b.booking_id, c.brand, c.model, c.images[1] AS car_image,
                  b.total_cost, b.status
           FROM booking_info b
           JOIN cars c ON b.vehicle_id = c.car_id
           WHERE b.user_id = $1
           ORDER BY b.booking_ts DESC
           LIMIT 1`,
          [userId]
     );

     res.status(HTTP_STATUS.OK).json({
          total_bookings: parseInt(totalBookingsResult.rows[0]?.total_bookings || 0),
          active_bookings: parseInt(activeBookingsResult.rows[0]?.active_bookings || 0),
          total_spent: parseInt(totalSpentResult.rows[0]?.total_spent || 0),
          favourite_count: favouriteCount,
          unread_notifications: parseInt(unreadResult.rows[0]?.unread_notifications || 0),
          upcoming_booking: upcomingResult.rows[0] || null,
          recent_booking: recentResult.rows[0] || null,
     });
});

const getFilteredUsers = async (req, res) => {
    const { search, status, verified, role, page = 0, limit = 10 } = req.query;
    const offset = page * limit;

    let query = `
        SELECT u.*, a.display_name as address, a.city, a.area
        FROM users u
        JOIN address a ON u.address_id = a.address_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        params.push(`%${search}%`);
        query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length})`;
    }

    if (status && status !== "All") {
        params.push(status);
        query += ` AND u.accountstatus = $${params.length}`;
    }

    if (verified && verified !== "All") {
        const verifiedBool = verified === "Yes";
        params.push(verifiedBool);
        query += ` AND u.verified = $${params.length}`;
    }

    if (role && role !== "All") {
        const roleMap = {
            "Customer": "user",
            "Agency Owner": "agency",
            "Admin": "admin"
        };
        params.push(roleMap[role] || role.toLowerCase());
        query += ` AND u.userrole = $${params.length}`;
    }

    try {
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered_users`;
        const totalCountResult = await pool.query(countQuery, params);
        const totalCount = parseInt(totalCountResult.rows[0].count);

        const resultQuery = query + ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const result = await pool.query(resultQuery, [...params, limit, offset]);
        
        res.json({
            users: result.rows,
            totalCount
        });
    } catch (err) {
        console.error("Error fetching filtered users:", err);
        res.status(500).send(err.message);
    }
};

const getUserAdminDetails = async (req, res) => {
    const { userId } = req.params;

    try {
        const profileQuery = `
            SELECT u.*, a.*
            FROM users u
            JOIN address a ON u.address_id = a.address_id
            WHERE u.user_id = $1
        `;
        const profileResult = await pool.query(profileQuery, [userId]);
        if (profileResult.rowCount === 0) return res.status(404).json({ message: "User not found" });

        const bookingsQuery = `
            SELECT b.*, COALESCE(c.brand, bk.brand) as brand, COALESCE(c.model, bk.model) as model
            FROM booking_info b
            LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
            WHERE b.user_id = $1
            ORDER BY b.booking_ts DESC
            LIMIT 5
        `;
        const bookingsResult = await pool.query(bookingsQuery, [userId]);

        const statsQuery = `
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancellation_count,
                (SELECT COUNT(*) FROM damage_reports dr JOIN booking_info bi ON dr.booking_id = bi.booking_id WHERE bi.user_id = $1) as damage_reports_count
            FROM booking_info
            WHERE user_id = $1
        `;
        const statsResult = await pool.query(statsQuery, [userId]);

        res.json({
            profile: profileResult.rows[0],
            bookings: bookingsResult.rows,
            activity: statsResult.rows[0]
        });

    } catch (err) {
        console.error("Error fetching admin user details:", err);
        res.status(500).send(err.message);
    }
};

const updateUserByAdmin = async (req, res) => {
    const { userId } = req.params;
    const { accountstatus, userrole, verified } = req.body;

    const query = `
        UPDATE users
        SET accountstatus = $1, userrole = $2, verified = $3
        WHERE user_id = $4
        RETURNING *
    `;

    try {
        const result = await pool.query(query, [accountstatus, userrole, verified, userId]);
        if (result.rowCount === 0) return res.status(404).json({ message: "User not found" });
        res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (err) {
        console.error("Error updating user by admin:", err);
        res.status(500).send(err.message);
    }
};

module.exports = { showAllUsers, getUserRole, getUser, getBookings, createUser, checkNID, checkPhone, updateUserInfo, updateUserAddress, getUserById, getDashboardStats, getFilteredUsers, getUserAdminDetails, updateUserByAdmin };
