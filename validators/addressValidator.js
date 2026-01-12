const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const helpers = require('./helpers/validationHelpers');

/**
 * Address Validator
 * Common validation functions for address-related operations
 * Can be used across users, agencies, drivers, etc.
 */
const addressValidator = {
     /**
      * Validates complete address for creation
      * @param {Object} data - Address data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateCreateAddress(data) {
          const { city, area, postcode, latitude, longitude, display_name, place_id } = data;
          const errors = [];

          // Validate city (required)
          if (!city || typeof city !== 'string') {
               errors.push({ field: 'city', message: 'City is required' });
          } else if (!helpers.isValidLength(city, 2, 30)) {
               errors.push({ field: 'city', message: 'City must be between 2 and 30 characters' });
          }

          // Validate area (required)
          if (!area || typeof area !== 'string') {
               errors.push({ field: 'area', message: 'Area is required' });
          } else if (!helpers.isValidLength(area, 2, 150)) {
               errors.push({ field: 'area', message: 'Area must be between 2 and 150 characters' });
          }

          // Validate postcode (optional)
          if (postcode && !helpers.isValidLength(postcode, 4, 20)) {
               errors.push({ field: 'postcode', message: MESSAGES.INVALID_POSTCODE });
          }

          // Validate latitude (required)
          if (latitude === undefined || latitude === null) {
               errors.push({ field: 'latitude', message: 'Latitude is required' });
          } else if (!helpers.isValidLatitude(parseFloat(latitude))) {
               errors.push({ field: 'latitude', message: MESSAGES.INVALID_COORDINATES });
          }

          // Validate longitude (required)
          if (longitude === undefined || longitude === null) {
               errors.push({ field: 'longitude', message: 'Longitude is required' });
          } else if (!helpers.isValidLongitude(parseFloat(longitude))) {
               errors.push({ field: 'longitude', message: MESSAGES.INVALID_COORDINATES });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return {
               city: helpers.sanitizeString(city),
               area: helpers.sanitizeString(area),
               postcode: postcode ? postcode.trim() : null,
               latitude: parseFloat(latitude),
               longitude: parseFloat(longitude),
               display_name: display_name ? helpers.sanitizeString(display_name) : null,
               place_id: place_id ? place_id.trim() : null
          };
     },

     /**
      * Validates address update (Partial Update)
      * Only validates fields that are provided
      * @param {Object} data - Address data
      * @returns {Object} - Validated and sanitized data (only provided fields)
      * @throws {AppError} - If validation fails or no valid fields provided
      */
     validateUpdateAddress(data) {
          const { city, area, postcode, latitude, longitude, display_name, place_id } = data;
          const errors = [];
          const sanitizedData = {};

          // Validate city (optional)
          if (city !== undefined) {
               if (typeof city !== 'string' || !helpers.isValidLength(city, 2, 30)) {
                    errors.push({ field: 'city', message: 'City must be between 2 and 30 characters' });
               } else {
                    sanitizedData.city = helpers.sanitizeString(city);
               }
          }

          // Validate area (optional)
          if (area !== undefined) {
               if (typeof area !== 'string' || !helpers.isValidLength(area, 2, 150)) {
                    errors.push({ field: 'area', message: 'Area must be between 2 and 150 characters' });
               } else {
                    sanitizedData.area = helpers.sanitizeString(area);
               }
          }

          // Validate postcode (optional)
          if (postcode !== undefined) {
               if (postcode && !helpers.isValidLength(postcode, 4, 20)) {
                    errors.push({ field: 'postcode', message: MESSAGES.INVALID_POSTCODE });
               } else {
                    sanitizedData.postcode = postcode ? postcode.trim() : null;
               }
          }

          // Validate latitude (optional)
          if (latitude !== undefined) {
               if (!helpers.isValidLatitude(parseFloat(latitude))) {
                    errors.push({ field: 'latitude', message: MESSAGES.INVALID_COORDINATES });
               } else {
                    sanitizedData.latitude = parseFloat(latitude);
               }
          }

          // Validate longitude (optional)
          if (longitude !== undefined) {
               if (!helpers.isValidLongitude(parseFloat(longitude))) {
                    errors.push({ field: 'longitude', message: MESSAGES.INVALID_COORDINATES });
               } else {
                    sanitizedData.longitude = parseFloat(longitude);
               }
          }

          // Validate display_name (optional)
          if (display_name !== undefined) {
               if (display_name && !helpers.isValidLength(display_name, 0, 250)) {
                    errors.push({ field: 'display_name', message: 'Display name must not exceed 250 characters' });
               } else {
                    sanitizedData.display_name = display_name ? helpers.sanitizeString(display_name) : null;
               }
          }

          // Validate place_id (optional)
          if (place_id !== undefined) {
               if (place_id && !helpers.isValidLength(place_id, 0, 100)) {
                    errors.push({ field: 'place_id', message: 'Place ID must not exceed 100 characters' });
               } else {
                    sanitizedData.place_id = place_id ? place_id.trim() : null;
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          // Ensure at least one field is provided for update
          if (Object.keys(sanitizedData).length === 0) {
               throw new AppError('At least one address field is required for update', HTTP_STATUS.BAD_REQUEST);
          }

          return sanitizedData;
     },

     /**
      * Validates address ID parameter
      * @param {string} id - Address ID to validate
      * @returns {string} - Validated ID
      * @throws {AppError} - If validation fails
      */
     validateAddressId(id) {
          if (!id || typeof id !== 'string' || id.trim() === '') {
               throw new AppError('Invalid address ID', HTTP_STATUS.BAD_REQUEST);
          }
          return id.trim();
     },
};

module.exports = addressValidator;
