const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const ENUMS = require('../constants/enums');

const generateCarId = () => {
     const timestampPart = String(Date.now()).slice(-8);
     const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
     return `CAR-${timestampPart}${randomPart}`;
};

const generateDocumentationId = () => {
     const timestampPart = String(Date.now()).slice(-7);
     const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
     return `CDOC-${timestampPart}${randomPart}`;
};

/**
 * Car Service
 * Contains business logic for car-related operations
 */
const carService = {
     /**
      * Creates a car and its documentation record in a single transaction
      * @param {Object} carData - Validated car payload
      * @returns {Object} - Created car and documentation records
      */
     async createCar(carData) {
          const client = await pool.connect();

          try {
               await client.query('BEGIN');

               const agencyQuery = `
                    SELECT agency_id
                    FROM agencies
                    WHERE agency_id = $1
               `;

               const agencyResult = await client.query(agencyQuery, [carData.agency_id]);

               if (agencyResult.rowCount === 0) {
                    throw new AppError(MESSAGES.AGENCY_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
               }

               const carId = generateCarId();

               const carInsertQuery = `
                    INSERT INTO cars (
                         car_id,
                         agency_id,
                         brand,
                         model,
                         car_type,
                         build_year,
                         images,
                         seats,
                         fuel,
                         mileage,
                         gear,
                         rental_price,
                         transmission_type,
                         about,
                         air_conditioning,
                         gps,
                         bluetooth,
                         central_locking,
                         status,
                         verified,
                         next_available_at
                    )
                    VALUES (
                         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                    )
                    RETURNING *
               `;

               const carValues = [
                    carId,
                    carData.agency_id,
                    carData.brand,
                    carData.model,
                    carData.car_type,
                    carData.build_year,
                    carData.images,
                    carData.seats,
                    carData.fuel,
                    carData.mileage,
                    carData.gear,
                    carData.rental_price,
                    carData.transmission_type,
                    carData.about,
                    carData.air_conditioning,
                    carData.gps,
                    carData.bluetooth,
                    carData.central_locking,
                    carData.status,
                    carData.verified,
                    carData.next_available_at
               ];

               const carResult = await client.query(carInsertQuery, carValues);

               if (carResult.rowCount === 0) {
                    throw new AppError(MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
               }

               const documentationId = generateDocumentationId();

               const documentationQuery = `
                    INSERT INTO cars_documentation (
                         documentation_id,
                         car_id,
                         license_number,
                         expire_date,
                         fitness_certificate,
                         issuing_authority,
                         insurance_number,
                         insurance_start_date,
                         insurance_ending_date,
                         insurance_provider,
                         insurance_coverage_type
                    )
                    VALUES (
                         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    )
                    RETURNING *
               `;

               const documentationValues = [
                    documentationId,
                    carId,
                    carData.documentation.license_number,
                    carData.documentation.expire_date,
                    carData.documentation.fitness_certificate,
                    carData.documentation.issuing_authority,
                    carData.documentation.insurance_number,
                    carData.documentation.insurance_start_date,
                    carData.documentation.insurance_ending_date,
                    carData.documentation.insurance_provider,
                    carData.documentation.insurance_coverage_type
               ];

               const documentationResult = await client.query(documentationQuery, documentationValues);

               if (documentationResult.rowCount === 0) {
                    throw new AppError(MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
               }

               await client.query('COMMIT');

               return {
                    car: carResult.rows[0],
                    documentation: documentationResult.rows[0]
               };
          } catch (error) {
               await client.query('ROLLBACK');
               throw error;
          } finally {
               client.release();
          }
     },

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
