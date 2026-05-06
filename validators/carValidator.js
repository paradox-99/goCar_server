const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const helpers = require('./helpers/validationHelpers');

/**
 * Car Validator
 * Contains validation functions for car-related operations
 */
const carValidator = {
     /**
      * Validates car ID parameter
      * @param {string} id - Car ID to validate
      * @returns {string} - Validated ID
      * @throws {AppError} - If validation fails
      */
     validateCarId(id) {
          if (!id || typeof id !== 'string' || id.trim() === '') {
               throw new AppError(MESSAGES.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
          }

          return id.trim();
     },

     /**
      * Validates create car request
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateCreateCar(data) {
          const {
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
               next_available_at,
               documentation
          } = data;

          const errors = [];

          if (!agency_id || typeof agency_id !== 'string') {
               errors.push({ field: 'agency_id', message: 'Agency ID is required' });
          }

          if (!brand || typeof brand !== 'string') {
               errors.push({ field: 'brand', message: 'Car brand is required' });
          } else if (!helpers.isValidLength(brand, 2, 20)) {
               errors.push({ field: 'brand', message: 'Brand must be between 2 and 20 characters' });
          }

          if (!model || typeof model !== 'string') {
               errors.push({ field: 'model', message: 'Car model is required' });
          } else if (!helpers.isValidLength(model, 2, 20)) {
               errors.push({ field: 'model', message: 'Model must be between 2 and 20 characters' });
          }

          if (!car_type || typeof car_type !== 'string') {
               errors.push({ field: 'car_type', message: 'Car type is required' });
          } else if (!helpers.isValidEnum(car_type.toLowerCase(), require('../constants/enums').CAR_TYPE)) {
               errors.push({ field: 'car_type', message: `Car type must be one of: ${require('../constants/enums').CAR_TYPE.join(', ')}` });
          }

          if (build_year !== undefined) {
               const parsedYear = parseInt(build_year, 10);
               if (!helpers.isValidBuildYear(parsedYear)) {
                    errors.push({ field: 'build_year', message: MESSAGES.INVALID_YEAR });
               }
          }

          if (images !== undefined && typeof images !== 'string') {
               errors.push({ field: 'images', message: 'Images must be a valid string URL' });
          }

          if (seats !== undefined) {
               const parsedSeats = parseInt(seats, 10);
               if (!helpers.isPositiveInteger(parsedSeats)) {
                    errors.push({ field: 'seats', message: 'Seats must be a positive integer' });
               }
          }

          if (fuel !== undefined && !helpers.isValidEnum(String(fuel), require('../constants/enums').FUEL_TYPE)) {
               errors.push({ field: 'fuel', message: `Fuel type must be one of: ${require('../constants/enums').FUEL_TYPE.join(', ')}` });
          }

          if (mileage !== undefined) {
               const parsedMileage = parseFloat(mileage);
               if (Number.isNaN(parsedMileage) || parsedMileage < 0) {
                    errors.push({ field: 'mileage', message: 'Mileage must be a non-negative number' });
               }
          }

          if (gear !== undefined) {
               const parsedGear = parseInt(gear, 10);
               if (!Number.isInteger(parsedGear) || parsedGear < 0) {
                    errors.push({ field: 'gear', message: 'Gear must be a non-negative integer' });
               }
          }

          if (rental_price === undefined) {
               errors.push({ field: 'rental_price', message: 'Rental price is required' });
          } else {
               const parsedPrice = parseInt(rental_price, 10);
               if (!helpers.isPositiveInteger(parsedPrice)) {
                    errors.push({ field: 'rental_price', message: MESSAGES.INVALID_PRICE });
               }
          }

          if (transmission_type !== undefined && !helpers.isValidEnum(String(transmission_type), require('../constants/enums').TRANSMISSION_TYPE)) {
               errors.push({ field: 'transmission_type', message: `Transmission type must be one of: ${require('../constants/enums').TRANSMISSION_TYPE.join(', ')}` });
          }

          if (about !== undefined && about !== null && !helpers.isValidLength(about, 2, 1000)) {
               errors.push({ field: 'about', message: 'About must be between 2 and 1000 characters' });
          }

          if (air_conditioning !== undefined && typeof air_conditioning !== 'boolean') {
               errors.push({ field: 'air_conditioning', message: 'Air conditioning must be a boolean value' });
          }

          if (gps !== undefined && typeof gps !== 'boolean') {
               errors.push({ field: 'gps', message: 'GPS must be a boolean value' });
          }

          if (bluetooth !== undefined && typeof bluetooth !== 'boolean') {
               errors.push({ field: 'bluetooth', message: 'Bluetooth must be a boolean value' });
          }

          if (central_locking !== undefined && typeof central_locking !== 'boolean') {
               errors.push({ field: 'central_locking', message: 'Central locking must be a boolean value' });
          }

          if (status !== undefined && !helpers.isValidEnum(String(status).toLowerCase(), require('../constants/enums').VEHICLE_STATUS)) {
               errors.push({ field: 'status', message: `Status must be one of: ${require('../constants/enums').VEHICLE_STATUS.join(', ')}` });
          }

          if (verified !== undefined && typeof verified !== 'boolean') {
               errors.push({ field: 'verified', message: 'Verified must be a boolean value' });
          }

          if (next_available_at !== undefined && next_available_at !== null && !helpers.isValidDate(next_available_at)) {
               errors.push({ field: 'next_available_at', message: MESSAGES.INVALID_DATE });
          }

          if (!documentation || typeof documentation !== 'object' || Array.isArray(documentation)) {
               errors.push({ field: 'documentation', message: 'Documentation object is required' });
          } else {
               const {
                    license_number,
                    expire_date,
                    fitness_certificate,
                    issuing_authority,
                    insurance_number,
                    insurance_start_date,
                    insurance_ending_date,
                    insurance_provider,
                    insurance_coverage_type
               } = documentation;

               if (license_number !== undefined && license_number !== null && (typeof license_number !== 'string' || !helpers.isValidLength(license_number, 1, 30))) {
                    errors.push({ field: 'documentation.license_number', message: 'License number must be between 1 and 30 characters' });
               }

               if (expire_date !== undefined && expire_date !== null && !helpers.isValidDate(expire_date)) {
                    errors.push({ field: 'documentation.expire_date', message: MESSAGES.INVALID_DATE });
               }

               if (fitness_certificate !== undefined && fitness_certificate !== null && (typeof fitness_certificate !== 'string' || !helpers.isValidLength(fitness_certificate, 1, 30))) {
                    errors.push({ field: 'documentation.fitness_certificate', message: 'Fitness certificate must be between 1 and 30 characters' });
               }

               if (issuing_authority !== undefined && issuing_authority !== null && (typeof issuing_authority !== 'string' || !helpers.isValidLength(issuing_authority, 1, 50))) {
                    errors.push({ field: 'documentation.issuing_authority', message: 'Issuing authority must be between 1 and 50 characters' });
               }

               if (insurance_number !== undefined && insurance_number !== null && (typeof insurance_number !== 'string' || !helpers.isValidLength(insurance_number, 1, 30))) {
                    errors.push({ field: 'documentation.insurance_number', message: 'Insurance number must be between 1 and 30 characters' });
               }

               if (insurance_start_date !== undefined && insurance_start_date !== null && !helpers.isValidDate(insurance_start_date)) {
                    errors.push({ field: 'documentation.insurance_start_date', message: MESSAGES.INVALID_DATE });
               }

               if (insurance_ending_date !== undefined && insurance_ending_date !== null && !helpers.isValidDate(insurance_ending_date)) {
                    errors.push({ field: 'documentation.insurance_ending_date', message: MESSAGES.INVALID_DATE });
               }

               if (
                    insurance_start_date !== undefined &&
                    insurance_start_date !== null &&
                    insurance_ending_date !== undefined &&
                    insurance_ending_date !== null &&
                    helpers.isValidDate(insurance_start_date) &&
                    helpers.isValidDate(insurance_ending_date)
               ) {
                    const startDate = new Date(insurance_start_date);
                    const endDate = new Date(insurance_ending_date);

                    if (endDate < startDate) {
                         errors.push({ field: 'documentation.insurance_ending_date', message: 'Insurance ending date cannot be before insurance start date' });
                    }
               }

               if (insurance_provider !== undefined && insurance_provider !== null && (typeof insurance_provider !== 'string' || !helpers.isValidLength(insurance_provider, 1, 100))) {
                    errors.push({ field: 'documentation.insurance_provider', message: 'Insurance provider must be between 1 and 100 characters' });
               }

               if (insurance_coverage_type !== undefined && insurance_coverage_type !== null && !helpers.isValidEnum(String(insurance_coverage_type).toLowerCase(), require('../constants/enums').INSURANCE_COVERAGE)) {
                    errors.push({ field: 'documentation.insurance_coverage_type', message: `Insurance coverage type must be one of: ${require('../constants/enums').INSURANCE_COVERAGE.join(', ')}` });
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return {
               agency_id: agency_id.trim(),
               brand: helpers.sanitizeString(brand),
               model: helpers.sanitizeString(model),
               car_type: car_type.toLowerCase().trim(),
               build_year: build_year !== undefined ? parseInt(build_year, 10) : null,
               images: images ? `{${images}}` : '{}',
               seats: seats !== undefined ? parseInt(seats, 10) : null,
               fuel: fuel !== undefined ? String(fuel).toLowerCase().trim() : null,
               mileage: mileage !== undefined ? parseFloat(mileage) : null,
               gear: gear !== undefined ? parseInt(gear, 10) : null,
               rental_price: parseInt(rental_price, 10),
               transmission_type: transmission_type !== undefined ? String(transmission_type).toLowerCase().trim() : null,
               about: about !== undefined && about !== null ? helpers.sanitizeString(about) : null,
               air_conditioning: air_conditioning !== undefined ? air_conditioning : null,
               gps: gps !== undefined ? gps : null,
               bluetooth: bluetooth !== undefined ? bluetooth : null,
               central_locking: central_locking !== undefined ? central_locking : null,
               status: status !== undefined ? String(status).trim().charAt(0).toUpperCase() + String(status).trim().slice(1).toLowerCase() : 'Unavailable',
               verified: verified !== undefined ? verified : false,
               next_available_at: next_available_at !== undefined && next_available_at !== null ? helpers.formatDateTime(next_available_at) : null,
               documentation: {
                    license_number: documentation.license_number !== undefined && documentation.license_number !== null ? documentation.license_number.trim() : null,
                    expire_date: documentation.expire_date !== undefined && documentation.expire_date !== null ? helpers.formatDate(documentation.expire_date) : null,
                    fitness_certificate: documentation.fitness_certificate !== undefined && documentation.fitness_certificate !== null ? documentation.fitness_certificate.trim() : null,
                    issuing_authority: documentation.issuing_authority !== undefined && documentation.issuing_authority !== null ? helpers.sanitizeString(documentation.issuing_authority) : null,
                    insurance_number: documentation.insurance_number !== undefined && documentation.insurance_number !== null ? documentation.insurance_number.trim() : null,
                    insurance_start_date: documentation.insurance_start_date !== undefined && documentation.insurance_start_date !== null ? helpers.formatDate(documentation.insurance_start_date) : null,
                    insurance_ending_date: documentation.insurance_ending_date !== undefined && documentation.insurance_ending_date !== null ? helpers.formatDate(documentation.insurance_ending_date) : null,
                    insurance_provider: documentation.insurance_provider !== undefined && documentation.insurance_provider !== null ? helpers.sanitizeString(documentation.insurance_provider) : null,
                    insurance_coverage_type: documentation.insurance_coverage_type !== undefined && documentation.insurance_coverage_type !== null ? String(documentation.insurance_coverage_type).toLowerCase().trim() : null
               }
          };
     },

     /**
      * Validates update car info request (status, price, about)
      * Dynamically validates only provided fields
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateUpdateCarInfo(data) {
          const { status, rental_price, about } = data;
          const errors = [];
          const sanitizedData = {};

          if (status !== undefined) {
               if (typeof status !== 'string' || !helpers.isValidLength(status, 2, 30)) {
                    errors.push({ field: 'status', message: MESSAGES.INVALID_STATUS });
               } else {
                    sanitizedData.status = String(status).trim().charAt(0).toUpperCase() + String(status).trim().slice(1).toLowerCase();
               }
          }

          if (rental_price !== undefined) {
               const parsedPrice = Number(rental_price);
               if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
                    errors.push({ field: 'price', message: MESSAGES.INVALID_PRICE });
               } else {
                    sanitizedData.price = parsedPrice;
               }
          }

          if (about !== undefined) {
               if (about !== null && (typeof about !== 'string' || !helpers.isValidLength(about, 2, 1000))) {
                    errors.push({ field: 'about', message: 'About must be between 2 and 1000 characters' });
               } else {
                    sanitizedData.about = about === null ? null : helpers.sanitizeString(about);
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          if (Object.keys(sanitizedData).length === 0) {
               throw new AppError('At least one field (status, price, or about) is required for update', HTTP_STATUS.BAD_REQUEST);
          }

          return sanitizedData;
     }
};

module.exports = carValidator;
