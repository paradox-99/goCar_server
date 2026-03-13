const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

/**
 * User Service
 * Contains business logic for user-related operations
 */
const userService = {
     /**
      * Updates user information dynamically based on provided fields
      * @param {string} userId - User ID to update
      * @param {Object} userData - User data fields to update
      * @returns {Object} - Updated user information
      * @throws {AppError} - If user not found or update fails
      */
     async updateUserInfo(userId, userData) {
          // First, check if the user exists
          const checkQuery = `
               SELECT user_id
               FROM users
               WHERE user_id = $1
          `;

          const existingUser = await pool.query(checkQuery, [userId]);

          if (existingUser.rowCount === 0) {
               throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
          }

          // Build dynamic update query based on provided fields
          const allowedFields = [
               'name', 'photo', 'gender', 'phone', 'license_number', 'expire_date', 'experience'
          ];
          const setClauses = [];
          const values = [];
          let paramIndex = 1;

          for (const field of allowedFields) {
               if (userData[field] !== undefined) {
                    setClauses.push(`${field} = $${paramIndex}`);
                    values.push(userData[field]);
                    paramIndex++;
               }
          }

          // Add userId as the last parameter
          values.push(userId);

          const updateQuery = `
               UPDATE users
               SET ${setClauses.join(', ')}
               WHERE user_id = $${paramIndex}
               RETURNING user_id, name, email, phone, gender, photo, license_number, expire_date, experience, verified, accountstatus, userrole
          `;

          const result = await pool.query(updateQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     },

     /**
      * Updates user address information dynamically based on provided fields
      * @param {string} userId - User ID whose address needs to be updated
      * @param {Object} addressData - Address data fields to update
      * @returns {Object} - Updated address information
      * @throws {AppError} - If user or address not found, or update fails
      */
     async updateUserAddress(userId, addressData) {
          // First, get the user's address_id
          const getUserQuery = `
               SELECT address_id
               FROM users
               WHERE user_id = $1
          `;

          const userResult = await pool.query(getUserQuery, [userId]);

          if (userResult.rowCount === 0) {
               throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
          }

          const addressId = userResult.rows[0].address_id;

          if (!addressId) {
               throw new AppError('User address not found', HTTP_STATUS.NOT_FOUND);
          }

          // Build dynamic update query for address based on provided fields
          const allowedFields = ['city', 'area', 'postcode', 'display_name'];
          const setClauses = [];
          const values = [];
          let paramIndex = 1;

          for (const field of allowedFields) {
               if (addressData[field] !== undefined) {
                    setClauses.push(`${field} = $${paramIndex}`);
                    values.push(addressData[field]);
                    paramIndex++;
               }
          }

          // Add addressId as the last parameter
          values.push(addressId);

          const updateQuery = `
               UPDATE address
               SET ${setClauses.join(', ')}
               WHERE address_id = $${paramIndex}
               RETURNING address_id, city, area, postcode, display_name
          `;

          const result = await pool.query(updateQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     }
};

module.exports = userService;
