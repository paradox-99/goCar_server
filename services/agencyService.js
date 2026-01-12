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

          // Build dynamic update query based on provided fields
          const allowedFields = ['name', 'phone', 'dob', 'gender'];
          const setClauses = [];
          const values = [];
          let paramIndex = 1;

          for (const field of allowedFields) {
               if (ownerData[field] !== undefined) {
                    setClauses.push(`${field} = $${paramIndex}`);
                    values.push(ownerData[field]);
                    paramIndex++;
               }
          }

          // Add updated_at timestamp
          setClauses.push(`updated_at = NOW()`);

          // Add ownerId as the last parameter
          values.push(ownerId);

          const updateQuery = `
               UPDATE users
               SET ${setClauses.join(', ')}
               WHERE user_id = $${paramIndex}
               RETURNING user_id, name, phone, dob, gender, email, updated_at
          `;

          const result = await pool.query(updateQuery, values);

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
     },

     /**
      * Updates agency information (Partial Update)
      * @param {string} agencyId - The agency ID
      * @param {Object} agencyData - Object containing fields to update
      * @returns {Object} - Updated agency information
      * @throws {AppError} - If update fails or agency not found
      */
     async updateAgencyInfo(agencyId, agencyData) {
          // First, check if the agency exists
          const checkQuery = `
               SELECT agency_id, agency_name, phone_number, email, status
               FROM agencies
               WHERE agency_id = $1
          `;

          const existingAgency = await pool.query(checkQuery, [agencyId]);

          if (existingAgency.rowCount === 0) {
               throw new AppError(MESSAGES.AGENCY_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          // Build dynamic update query based on provided fields
          const allowedFields = [
               'agency_name', 'phone_number', 'email', 'status',
               'license', 'tin', 'insurancenumber', 'tradelicenseexpire',
               'verified'
          ];
          const setClauses = [];
          const values = [];
          let paramIndex = 1;

          for (const field of allowedFields) {
               if (agencyData[field] !== undefined) {
                    setClauses.push(`${field} = $${paramIndex}`);
                    values.push(agencyData[field]);
                    paramIndex++;
               }
          }

          // Add agencyId as the last parameter
          values.push(agencyId);

          const updateQuery = `
               UPDATE agencies
               SET ${setClauses.join(', ')}
               WHERE agency_id = $${paramIndex}
               RETURNING agency_id, agency_name, phone_number, email, license, tin, 
                         insurancenumber, tradelicenseexpire, status, verified,
                         cars, bikes, rating, rating_count, review_count
          `;

          const result = await pool.query(updateQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     },

     /**
      * Gets agency by ID
      * @param {string} agencyId - The agency ID
      * @returns {Object} - Agency information
      * @throws {AppError} - If agency not found
      */
     async getAgencyById(agencyId) {
          const query = `
               SELECT agencies.*, address.city, address.area, address.postcode, 
                      address.display_name, address.latitude, address.longitude
               FROM agencies
               LEFT JOIN address ON agencies.address_id = address.address_id
               WHERE agencies.agency_id = $1
          `;

          const result = await pool.query(query, [agencyId]);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.AGENCY_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          return result.rows[0];
     }
};

module.exports = agencyService;
