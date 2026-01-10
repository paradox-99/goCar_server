const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

/**
 * Agency Service
 * Contains business logic for agency-related operations
 * Separates database operations from controllers
 */
const agencyService = {
     /**
      * Updates agency owner information
      * @param {string} ownerId - The owner's user ID
      * @param {Object} ownerData - Object containing name, phone, dob, gender
      * @returns {Object} - Updated owner information
      * @throws {AppError} - If update fails or user not found
      */
     async updateAgencyOwnerInfo(ownerId, ownerData) {
          const { name, phone, dob, gender } = ownerData;

          // First, check if the user exists
          const checkQuery = `
               SELECT user_id, name, phone, dob, gender
               FROM users
               WHERE user_id = $1
          `;

          const existingUser = await pool.query(checkQuery, [ownerId]);

          if (existingUser.rowCount === 0) {
               throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          // Update the user information
          const updateQuery = `
               UPDATE users
               SET name = $1, 
                   phone = $2, 
                   dob = $3, 
                   gender = $4,
                   updated_at = NOW()
               WHERE user_id = $5
               RETURNING user_id, name, phone, dob, gender, email, updated_at
          `;

          const result = await pool.query(updateQuery, [name, phone, dob, gender, ownerId]);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     },

     /**
      * Gets owner information by ID
      * @param {string} ownerId - The owner's user ID
      * @returns {Object} - Owner information
      * @throws {AppError} - If user not found
      */
     async getOwnerById(ownerId) {
          const query = `
               SELECT user_id, name, phone, dob, gender, email, photo
               FROM users
               WHERE user_id = $1
          `;

          const result = await pool.query(query, [ownerId]);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          return result.rows[0];
     },

     /**
      * Checks if user is an agency owner
      * @param {string} userId - The user ID to check
      * @returns {boolean} - True if user is an agency owner
      */
     async isAgencyOwner(userId) {
          const query = `
               SELECT agency_id
               FROM agencies
               WHERE owner_id = $1
          `;

          const result = await pool.query(query, [userId]);
          return result.rowCount > 0;
     }
};

module.exports = agencyService;
