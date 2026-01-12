const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

/**
 * Address Service
 * Common service for address-related operations
 * Can be used across users, agencies, drivers, etc.
 */
const addressService = {

     async getAddressById(addressId) {
          const query = `
               SELECT address_id, city, area, postcode, place_id, 
                      latitude, longitude, display_name
               FROM address
               WHERE address_id = $1
          `;

          const result = await pool.query(query, [addressId]);

          if (result.rowCount === 0) {
               throw new AppError('Address not found', HTTP_STATUS.NOT_FOUND);
          }

          return result.rows[0];
     },


     async updateAddress(addressId, addressData) {
          // First, check if the address exists
          const checkQuery = `
               SELECT address_id
               FROM address
               WHERE address_id = $1
          `;

          const existingAddress = await pool.query(checkQuery, [addressId]);

          if (existingAddress.rowCount === 0) {
               throw new AppError('Address not found', HTTP_STATUS.NOT_FOUND);
          }

          // Build dynamic update query based on provided fields
          const allowedFields = ['city', 'area', 'postcode', 'latitude', 'longitude', 'display_name', 'place_id'];
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

          // Update geom if latitude and longitude are provided
          if (addressData.latitude !== undefined && addressData.longitude !== undefined) {
               setClauses.push(`geom = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
               values.push(addressData.longitude, addressData.latitude);
               paramIndex += 2;
          }

          // Add addressId as the last parameter
          values.push(addressId);

          console.log(values);
          

          const updateQuery = `
               UPDATE address
               SET ${setClauses.join(', ')}
               WHERE address_id = $${paramIndex}
               RETURNING address_id, city, area, postcode, place_id, 
                         latitude, longitude, display_name
          `;

          const result = await pool.query(updateQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     },


     async createAddress(addressId, addressData) {
          const { city, area, postcode, latitude, longitude, display_name, place_id } = addressData;

          const query = `
               INSERT INTO address (address_id, city, area, postcode, latitude, longitude, display_name, place_id, geom)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography)
               RETURNING address_id, city, area, postcode, place_id, latitude, longitude, display_name
          `;

          const result = await pool.query(query, [
               addressId,
               city,
               area,
               postcode,
               latitude,
               longitude,
               display_name,
               place_id
          ]);

          if (result.rowCount === 0) {
               throw new AppError('Failed to create address', HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     }
};

module.exports = addressService;
