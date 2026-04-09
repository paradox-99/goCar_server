const pool = require('../config/db');
const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

const generateBikeId = () => {
     const timestampPart = String(Date.now()).slice(-8);
     const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
     return `BIKE-${timestampPart}${randomPart}`;
};

const generateDocumentationId = () => {
     const timestampPart = String(Date.now()).slice(-7);
     const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
     return `MDOC-${timestampPart}${randomPart}`;
};

const bikeService = {
     async createBike(bikeData) {
          const client = await pool.connect();

          try {
               await client.query('BEGIN');

          const agencyQuery = `
               SELECT agency_id
               FROM agencies
               WHERE agency_id = $1
          `;

          const agencyResult = await client.query(agencyQuery, [bikeData.agency_id]);

          if (agencyResult.rowCount === 0) {
               throw new AppError(MESSAGES.AGENCY_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
          }

          const bikeId = generateBikeId();

          const insertQuery = `
               INSERT INTO bikes (
                    bike_id,
                    agency_id,
                    brand,
                    model,
                    car_type,
                    build_year,
                    images,
                    fuel,
                    fuel_capacity,
                    mileage,
                    gear,
                    rental_price,
                    about,
                    engine_capacity,
                    helmet_count,
                    abs,
                    disk_brake,
                    status,
                    engine_start_type,
                    verified,
                    next_available_at
               )
               VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
               )
               RETURNING *
          `;

          const values = [
               bikeId,
               bikeData.agency_id,
               bikeData.brand,
               bikeData.model,
               bikeData.car_type,
               bikeData.build_year,
               bikeData.images,
               bikeData.fuel,
               bikeData.fuel_capacity,
               bikeData.mileage,
               bikeData.gear,
               bikeData.rental_price,
               bikeData.about,
               bikeData.engine_capacity,
               bikeData.helmet_count,
               bikeData.abs,
               bikeData.disk_brake,
               bikeData.status,
               bikeData.engine_start_type,
               bikeData.verified,
               bikeData.next_available_at
          ];

          const result = await client.query(insertQuery, values);

          if (result.rowCount === 0) {
               throw new AppError(MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
          }

               const documentationId = generateDocumentationId();

               const documentationQuery = `
                    INSERT INTO motorbike_documentation (
                         documentation_id,
                         bike_id,
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
                    bikeId,
                    bikeData.documentation.license_number,
                    bikeData.documentation.expire_date,
                    bikeData.documentation.fitness_certificate,
                    bikeData.documentation.issuing_authority,
                    bikeData.documentation.insurance_number,
                    bikeData.documentation.insurance_start_date,
                    bikeData.documentation.insurance_ending_date,
                    bikeData.documentation.insurance_provider,
                    bikeData.documentation.insurance_coverage_type
               ];

               const documentationResult = await client.query(documentationQuery, documentationValues);

               if (documentationResult.rowCount === 0) {
                    throw new AppError(MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
               }

               await client.query('COMMIT');

               return {
                    bike: result.rows[0],
                    documentation: documentationResult.rows[0]
               };
          } catch (error) {
               await client.query('ROLLBACK');
               throw error;
          } finally {
               client.release();
          }
     }
};

module.exports = bikeService;