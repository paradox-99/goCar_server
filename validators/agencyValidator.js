const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const ENUMS = require('../constants/enums');
const helpers = require('./helpers/validationHelpers');

/**
 * Agency Validator
 * Contains validation functions for agency-related operations
 */
const agencyValidator = {
     /**
      * Validates the update agency owner info request body (Partial Update)
      * Only validates and returns fields that are provided
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data (only provided fields)
      * @throws {AppError} - If validation fails or no valid fields provided
      */
     validateUpdateOwnerInfo(data) {
          const { name, phone, dob, gender } = data;
          const errors = [];
          const sanitizedData = {};

          // Validate name (optional)
          if (name !== undefined) {
               if (typeof name !== 'string' || !helpers.isValidLength(name, 2, 30)) {
                    errors.push({ field: 'name', message: MESSAGES.INVALID_NAME });
               } else {
                    sanitizedData.name = helpers.sanitizeString(name);
               }
          }

          // Validate phone (optional)
          if (phone !== undefined) {
               if (typeof phone !== 'string' || !helpers.isValidPhone(phone)) {
                    errors.push({ field: 'phone', message: MESSAGES.INVALID_PHONE });
               } else {
                    sanitizedData.phone = helpers.sanitizePhone(phone);
               }
          }

          // Validate date of birth (optional)
          if (dob !== undefined) {
               if (!helpers.isValidDate(dob)) {
                    errors.push({ field: 'dob', message: MESSAGES.INVALID_DOB });
               } else {
                    const age = helpers.calculateAge(dob);
                    if (age < 18 || age > 120) {
                         errors.push({ field: 'dob', message: 'Age must be between 18 and 120 years' });
                    } else {
                         sanitizedData.dob = helpers.formatDate(dob);
                    }
               }
          }

          // Validate gender (optional)
          if (gender !== undefined) {
               if (!helpers.isValidGender(gender)) {
                    errors.push({ field: 'gender', message: MESSAGES.INVALID_GENDER });
               } else {
                    sanitizedData.gender = gender.toLowerCase();
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          // Ensure at least one field is provided for update
          if (Object.keys(sanitizedData).length === 0) {
               throw new AppError('At least one field (name, phone, dob, or gender) is required for update', HTTP_STATUS.BAD_REQUEST);
          }

          return sanitizedData;
     },

     /**
      * Validates agency owner ID parameter
      * @param {string} id - Owner ID to validate
      * @returns {string} - Validated ID
      * @throws {AppError} - If validation fails
      */
     validateOwnerId(id) {
          if (!id || typeof id !== 'string' || id.trim() === '') {
               throw new AppError(MESSAGES.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
          }
          return id.trim();
     },

     /**
      * Validates create agency request
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateCreateAgency(data) {
          const {
               agency_name, phone_number, email, license, tin,
               insurancenumber, tradelicenseexpire, address
          } = data;
          const errors = [];

          // Validate agency name
          if (!agency_name || typeof agency_name !== 'string') {
               errors.push({ field: 'agency_name', message: 'Agency name is required' });
          } else if (!helpers.isValidLength(agency_name, 2, 50)) {
               errors.push({ field: 'agency_name', message: 'Agency name must be between 2 and 50 characters' });
          }

          // Validate phone number
          if (!phone_number) {
               errors.push({ field: 'phone_number', message: 'Phone number is required' });
          } else if (!helpers.isValidPhone(phone_number)) {
               errors.push({ field: 'phone_number', message: MESSAGES.INVALID_PHONE });
          }

          // Validate email
          if (!email) {
               errors.push({ field: 'email', message: 'Email is required' });
          } else if (!helpers.isValidEmail(email)) {
               errors.push({ field: 'email', message: MESSAGES.INVALID_EMAIL });
          }

          // Validate license
          if (!license || typeof license !== 'string') {
               errors.push({ field: 'license', message: 'License is required' });
          } else if (!helpers.isValidLength(license, 5, 30)) {
               errors.push({ field: 'license', message: MESSAGES.INVALID_LICENSE });
          }

          // Validate TIN
          if (!tin) {
               errors.push({ field: 'tin', message: 'TIN is required' });
          } else if (!helpers.isValidTIN(tin)) {
               errors.push({ field: 'tin', message: MESSAGES.INVALID_TIN });
          }

          // Validate insurance number
          if (insurancenumber && !helpers.isValidLength(insurancenumber, 5, 20)) {
               errors.push({ field: 'insurancenumber', message: MESSAGES.INVALID_INSURANCE });
          }

          // Validate trade license expiry
          if (!tradelicenseexpire) {
               errors.push({ field: 'tradelicenseexpire', message: 'Trade license expiry date is required' });
          } else if (!helpers.isValidDate(tradelicenseexpire)) {
               errors.push({ field: 'tradelicenseexpire', message: MESSAGES.INVALID_DATE });
          } else if (!helpers.isFutureDate(tradelicenseexpire)) {
               errors.push({ field: 'tradelicenseexpire', message: 'Trade license must not be expired' });
          }

          // Validate address
          if (!address || typeof address !== 'object') {
               errors.push({ field: 'address', message: 'Address is required' });
          } else {
               const addressErrors = this.validateAddress(address, false);
               errors.push(...addressErrors);
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return {
               agency_name: helpers.sanitizeString(agency_name),
               phone_number: helpers.sanitizePhone(phone_number),
               email: email.toLowerCase().trim(),
               license: license.trim(),
               tin: tin.trim(),
               insurancenumber: insurancenumber ? insurancenumber.trim() : null,
               tradelicenseexpire: helpers.formatDate(tradelicenseexpire),
               address: {
                    city: helpers.sanitizeString(address.city),
                    area: helpers.sanitizeString(address.area),
                    postcode: address.postcode?.trim() || null,
                    latitude: parseFloat(address.latitude),
                    longitude: parseFloat(address.longitude),
                    display_name: helpers.sanitizeString(address.display_name || ''),
                    place_id: address.place_id?.trim() || null
               }
          };
     },

     /**
      * Validates update agency request (Partial Update)
      * Only validates and returns fields that are provided
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails or no valid fields provided
      */
     validateUpdateAgency(data) {
          const { 
               agency_name, phone_number, email, status, 
               license, tin, insurancenumber, tradelicenseexpire,
               verified
          } = data;
          const errors = [];
          const sanitizedData = {};

          // Validate agency name (optional)
          if (agency_name !== undefined) {
               if (typeof agency_name !== 'string' || !helpers.isValidLength(agency_name, 2, 50)) {
                    errors.push({ field: 'agency_name', message: 'Agency name must be between 2 and 50 characters' });
               } else {
                    sanitizedData.agency_name = helpers.sanitizeString(agency_name);
               }
          }

          // Validate phone number (optional)
          if (phone_number !== undefined) {
               if (!helpers.isValidPhone(phone_number)) {
                    errors.push({ field: 'phone_number', message: MESSAGES.INVALID_PHONE });
               } else {
                    sanitizedData.phone_number = helpers.sanitizePhone(phone_number);
               }
          }

          // Validate email (optional)
          if (email !== undefined) {
               if (!helpers.isValidEmail(email)) {
                    errors.push({ field: 'email', message: MESSAGES.INVALID_EMAIL });
               } else {
                    sanitizedData.email = email.toLowerCase().trim();
               }
          }

          // Validate status (optional)
          if (status !== undefined) {
               if (!helpers.isValidEnum(status, ENUMS.AGENCY_STATUS)) {
                    errors.push({ field: 'status', message: `Status must be one of: ${ENUMS.AGENCY_STATUS.join(', ')}` });
               } else {
                    sanitizedData.status = status;
               }
          }

          // Validate license (optional)
          if (license !== undefined) {
               if (typeof license !== 'string' || !helpers.isValidLength(license, 5, 30)) {
                    errors.push({ field: 'license', message: 'License must be between 5 and 30 characters' });
               } else {
                    sanitizedData.license = license.trim();
               }
          }

          // Validate TIN (optional)
          if (tin !== undefined) {
               if (!helpers.isValidTIN(tin)) {
                    errors.push({ field: 'tin', message: MESSAGES.INVALID_TIN });
               } else {
                    sanitizedData.tin = tin.trim();
               }
          }

          // Validate insurance number (optional)
          if (insurancenumber !== undefined) {
               if (insurancenumber && !helpers.isValidLength(insurancenumber, 5, 20)) {
                    errors.push({ field: 'insurancenumber', message: MESSAGES.INVALID_INSURANCE });
               } else {
                    sanitizedData.insurancenumber = insurancenumber ? insurancenumber.trim() : null;
               }
          }

          // Validate trade license expiry (optional)
          if (tradelicenseexpire !== undefined) {
               if (!helpers.isValidDate(tradelicenseexpire)) {
                    errors.push({ field: 'tradelicenseexpire', message: MESSAGES.INVALID_DATE });
               } else {
                    sanitizedData.tradelicenseexpire = helpers.formatDate(tradelicenseexpire);
               }
          }

          // Validate verified (optional)
          if (verified !== undefined) {
               if (typeof verified !== 'boolean') {
                    errors.push({ field: 'verified', message: 'Verified must be a boolean value' });
               } else {
                    sanitizedData.verified = verified;
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          // Ensure at least one field is provided for update
          if (Object.keys(sanitizedData).length === 0) {
               throw new AppError('At least one field is required for update', HTTP_STATUS.BAD_REQUEST);
          }

          return sanitizedData;
     },

     /**
      * Validates agency ID parameter
      * @param {string} id - Agency ID to validate
      * @returns {string} - Validated ID
      * @throws {AppError} - If validation fails
      */
     validateAgencyId(id) {
          if (!id || typeof id !== 'string' || id.trim() === '') {
               throw new AppError(MESSAGES.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
          }
          return id.trim();
     },

     /**
      * Validates address object
      * @param {Object} address - Address data
      * @param {boolean} throwError - Whether to throw error or return errors
      * @returns {Array} - Array of validation errors
      */
     validateAddress(address, throwError = true) {
          const errors = [];

          if (!address.city || !helpers.isValidLength(address.city, 2, 30)) {
               errors.push({ field: 'address.city', message: 'City must be between 2 and 30 characters' });
          }

          if (!address.area || !helpers.isValidLength(address.area, 2, 150)) {
               errors.push({ field: 'address.area', message: 'Area must be between 2 and 150 characters' });
          }

          if (address.postcode && !helpers.isValidLength(address.postcode, 4, 20)) {
               errors.push({ field: 'address.postcode', message: MESSAGES.INVALID_POSTCODE });
          }

          if (address.latitude === undefined || !helpers.isValidLatitude(parseFloat(address.latitude))) {
               errors.push({ field: 'address.latitude', message: MESSAGES.INVALID_COORDINATES });
          }

          if (address.longitude === undefined || !helpers.isValidLongitude(parseFloat(address.longitude))) {
               errors.push({ field: 'address.longitude', message: MESSAGES.INVALID_COORDINATES });
          }

          if (throwError && errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return errors;
     },

     /**
      * Validates agency review
      * @param {Object} data - Review data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateAgencyReview(data) {
          const { agency_id, rating, review } = data;
          const errors = [];

          if (!agency_id || typeof agency_id !== 'string') {
               errors.push({ field: 'agency_id', message: 'Agency ID is required' });
          }

          if (rating === undefined || !helpers.isValidRating(parseFloat(rating))) {
               errors.push({ field: 'rating', message: MESSAGES.INVALID_RATING });
          }

          if (review && !helpers.isValidLength(review, 0, 1000)) {
               errors.push({ field: 'review', message: MESSAGES.REVIEW_TOO_LONG });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return {
               agency_id: agency_id.trim(),
               rating: parseFloat(rating),
               review: review ? helpers.sanitizeString(review) : null,
               date: helpers.formatDate(new Date())
          };
     }
};

module.exports = agencyValidator;
