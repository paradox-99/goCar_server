const pool = require('../config/db')
const { createDriverId, createAddressId } = require('./createIDs')

const showAllDrivers = async (req, res) => {
     const { lat, lon } = req.query

     const userLat = Number(lat);
     const userLon = Number(lon);

     try {
          // Search driver_info within 5km range using latitude and longitude
          const query = `
               SELECT
                d.driver_id,
                d.name,
                d.photo,
                d.phone,
                d.experience_year,
                d.rental_price,
                d.rating,
                a.display_name,
                ST_Distance(
                  ST_MakePoint(a.longitude, a.latitude)::geography,
                  ST_MakePoint($1, $2)::geography
                ) AS distance_meters
              FROM driver_info d
              JOIN address a ON a.address_id = d.address_id
              WHERE d.verified = TRUE
              AND ST_DWithin(
                ST_MakePoint(a.longitude, a.latitude)::geography,
                ST_MakePoint($1, $2)::geography,
                5000
               )
               ORDER BY distance_meters;
               `
          try {
               const result = await pool.query(query, [userLon, userLat]);
               res.json(result.rows);
          } catch (err) {
               res.status(500).send(err.message);
          }
     }
     catch (err) {
          res.status(500).send('Server Error');
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
     } catch (err) {
          res.status(500).send(err.message);
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
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const checkLicense = async (req, res) => {
     const license_number = req.params.license_number;

     const query = `
          SELECT driver_id AS id
          FROM driver_info
          WHERE license_number = $1
     `
     try {
          const result = await pool.query(query, [license_number]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'License not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'License found', code: 1 });
          }
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const createDriver = async (req, res) => {
     const { address, area, name, email, phone, gender, nid, birthdate, profilePicture, licenseNumber, licenseIssueDate, issuingAuthority, experience, hiringPrice, agency_id } = req.body;

     const driverId = createDriverId();
     const addressId = createAddressId();

     const verified = false
     const accountStatus = "active"
     const license_status = "pending"
     const availability = true

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
               INSERT INTO driver_info (driver_id, address_id, name, email, phone, gender, nid, dob, photo, availability, verified, accountstatus, license_number, license_status, expire_date, experience_year, rental_price, agency_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
               `;

               try {
                    const userResult = await pool.query(userQuery, [driverId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, availability, verified, accountStatus, licenseNumber, license_status, licenseIssueDate, experience, hiringPrice, agency_id || null]);
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

const getDriverProfile = async (req, res) => {
     const { email } = req.params;
     try {
          const result = await pool.query(
               `SELECT d.*, a.display_name, a.city, a.area, a.postcode
                FROM driver_info d
                LEFT JOIN address a ON d.address_id = a.address_id
                WHERE d.email = $1`,
               [email]
          );
          res.json(result.rows[0] || null);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const updateDriverAvailability = async (req, res) => {
     const { driverId } = req.params;
     const { availability } = req.body;
     try {
          await pool.query(
               `UPDATE driver_info SET availability = $2 WHERE driver_id = $1`,
               [driverId, Boolean(availability)]
          );
          res.json({ message: 'Driver availability updated' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const verifyDriverAccount = async (req, res) => {
     const { driverId } = req.params;
     const { verified } = req.body;
     try {
          await pool.query(
               `UPDATE driver_info SET verified = $2 WHERE driver_id = $1`,
               [driverId, Boolean(verified)]
          );
          res.json({ message: 'Driver verification status updated' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const getAgencyDriversByEmail = async (req, res) => {
     const email = req.params.email;
     const query = `
          SELECT d.*, a.display_name as address_display_name
          FROM driver_info d
          JOIN agencies ag ON d.agency_id = ag.agency_id
          JOIN users u ON ag.owner_id = u.user_id
          LEFT JOIN address a ON d.address_id = a.address_id
          WHERE u.email = $1
     `
     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const adminGetAllDrivers = async (req, res) => {
     const query = `
          SELECT d.*, a.display_name, ag.agency_name
          FROM driver_info d
          LEFT JOIN address a ON d.address_id = a.address_id
          LEFT JOIN agencies ag ON d.agency_id = ag.agency_id
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getDriverProfileById = async (req, res) => {
     const { id } = req.params;
     try {
          const result = await pool.query(
               `SELECT d.*, a.display_name, a.city, a.area, a.postcode, ag.agency_name
                FROM driver_info d
                LEFT JOIN address a ON d.address_id = a.address_id
                LEFT JOIN agencies ag ON d.agency_id = ag.agency_id
                WHERE d.driver_id = $1`,
               [id]
          );
          res.json(result.rows[0] || null);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const updateDriverInfoAdmin = async (req, res) => {
     const { driverId } = req.params;
     const { accountstatus, license_status, expire_date, verified, availability, rental_price, admin_note } = req.body;
     
     try {
          let updateFields = [];
          let queryValues = [];
          let paramIndex = 1;

          if (accountstatus !== undefined) {
               updateFields.push(`accountstatus = $${paramIndex++}`);
               queryValues.push(accountstatus);
          }
          if (license_status !== undefined) {
               updateFields.push(`license_status = $${paramIndex++}`);
               queryValues.push(license_status);
          }
          if (expire_date !== undefined) {
               updateFields.push(`expire_date = $${paramIndex++}`);
               queryValues.push(expire_date);
          }
          if (verified !== undefined) {
               updateFields.push(`verified = $${paramIndex++}`);
               queryValues.push(Boolean(verified));
          }
          if (availability !== undefined) {
               updateFields.push(`availability = $${paramIndex++}`);
               queryValues.push(Boolean(availability));
          }
          if (rental_price !== undefined) {
               updateFields.push(`rental_price = $${paramIndex++}`);
               queryValues.push(rental_price);
          }
          // Assuming admin_note is added or we just ignore it if it doesn't exist. The prompt asked to create an API to "update status and other relevant things". 

          if (updateFields.length === 0) {
               return res.status(400).json({ message: 'No fields to update' });
          }

          queryValues.push(driverId);
          const query = `UPDATE driver_info SET ${updateFields.join(', ')} WHERE driver_id = $${paramIndex}`;

          await pool.query(query, queryValues);
          res.json({ message: 'Driver information updated successfully' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const suspendDriver = async (req, res) => {
     const { driverId } = req.params;
     try {
          await pool.query(
               `UPDATE driver_info SET accountstatus = 'Suspended' WHERE driver_id = $1`,
               [driverId]
          );
          res.json({ message: 'Driver suspended successfully' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const removeFromAgency = async (req, res) => {
     const { driverId } = req.params;
     try {
          await pool.query(
               `UPDATE driver_info SET agency_id = NULL WHERE driver_id = $1`,
               [driverId]
          );
          res.json({ message: 'Driver removed from agency successfully' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = {
     showAllDrivers,
     checkNID,
     checkPhone,
     checkLicense,
     createDriver,
     getDriverProfile,
     updateDriverAvailability,
     verifyDriverAccount,
     getAgencyDriversByEmail,
     adminGetAllDrivers,
     getDriverProfileById,
     updateDriverInfoAdmin,
     suspendDriver,
     removeFromAgency
};