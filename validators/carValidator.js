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
                    sanitizedData.status = helpers.sanitizeString(status);
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
