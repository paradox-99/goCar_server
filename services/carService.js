const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

/**
 * Car Service
 * Contains business logic for car-related operations
 */
const carService = {
     /**
      * Updates car information dynamically based on provided fields
      * @param {string} carId - Car ID to update
      * @param {Object} carData - Fields to update
      * @returns {Object} - Updated car data
      * @throws {AppError} - If car not found or update fails
      */
     async updateCarInfo(carId, carData) {
          const checkQuery = `
               SELECT car_id
               FROM cars
               WHERE car_id = $1
          `;

          console.log(carData);
          const existingCar = await pool.query(checkQuery, [carId]);

          if (existingCar.rowCount === 0) {
               throw new AppError(MESSAGES.CAR_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          

          const fieldMap = {
               status: 'status',
               price: 'rental_price',
               about: 'about'
          };

          const setClauses = [];
          const values = [];
          let paramIndex = 1;

          for (const [payloadField, dbColumn] of Object.entries(fieldMap)) {
               if (carData[payloadField] !== undefined) {
                    setClauses.push(`${dbColumn} = $${paramIndex}`);
                    values.push(carData[payloadField]);
                    paramIndex++;
               }
          }

          values.push(carId);

          const updateQuery = `
               UPDATE cars
               SET ${setClauses.join(', ')}
               WHERE car_id = $${paramIndex}
               RETURNING car_id, status, rental_price, about
          `;

          const result = await pool.query(updateQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.UPDATE_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

          return result.rows[0];
     }
};

module.exports = carService;
