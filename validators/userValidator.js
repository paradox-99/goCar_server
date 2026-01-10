const AppError = require('../utils/AppError');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const ENUMS = require('../constants/enums');
const helpers = require('./helpers/validationHelpers');

/**
 * User Validator
 * Contains validation functions for user-related operations
 */
const userValidator = {
     /**
      * Validates create user request
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateCreateUser(data) {
          const { name, email, phone, gender, dob, photo, nid, address } = data;
          const errors = [];

          // Validate name
          if (!name || typeof name !== 'string') {
               errors.push({ field: 'name', message: 'Name is required' });
          } else if (!helpers.isValidLength(name, 2, 30)) {
               errors.push({ field: 'name', message: MESSAGES.INVALID_NAME });
          }

          // Validate email
          if (!email) {
               errors.push({ field: 'email', message: 'Email is required' });
          } else if (!helpers.isValidEmail(email)) {
               errors.push({ field: 'email', message: MESSAGES.INVALID_EMAIL });
          }

          // Validate phone
          if (!phone) {
               errors.push({ field: 'phone', message: 'Phone number is required' });
          } else if (!helpers.isValidPhone(phone)) {
               errors.push({ field: 'phone', message: MESSAGES.INVALID_PHONE });
          }

          // Validate gender (optional)
          if (gender && !helpers.isValidGender(gender)) {
               errors.push({ field: 'gender', message: MESSAGES.INVALID_GENDER });
          }

          // Validate date of birth (optional)
          if (dob) {
               if (!helpers.isValidDate(dob)) {
                    errors.push({ field: 'dob', message: MESSAGES.INVALID_DOB });
               } else {
                    const age = helpers.calculateAge(dob);
                    if (age < 18 || age > 120) {
                         errors.push({ field: 'dob', message: 'Age must be between 18 and 120 years' });
                    }
               }
          }

          // Validate photo URL (optional)
          if (photo && !helpers.isValidURL(photo) && !photo.startsWith('/')) {
               errors.push({ field: 'photo', message: 'Invalid photo URL format' });
          }

          // Validate NID (optional)
          if (nid && !helpers.isValidNID(nid)) {
               errors.push({ field: 'nid', message: MESSAGES.INVALID_NID });
          }

          // Validate address (optional)
          if (address && typeof address === 'object') {
               const addressErrors = this.validateAddress(address, false);
               errors.push(...addressErrors);
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          // Return sanitized data
          return {
               name: helpers.sanitizeString(name),
               email: email.toLowerCase().trim(),
               phone: helpers.sanitizePhone(phone),
               gender: gender ? gender.toLowerCase() : null,
               dob: dob ? helpers.formatDate(dob) : null,
               photo: photo ? photo.trim() : null,
               nid: nid ? nid.trim() : null,
               address: address ? {
                    city: helpers.sanitizeString(address.city || ''),
                    area: helpers.sanitizeString(address.area || ''),
                    postcode: address.postcode?.trim() || null,
                    latitude: address.latitude ? parseFloat(address.latitude) : null,
                    longitude: address.longitude ? parseFloat(address.longitude) : null,
                    display_name: helpers.sanitizeString(address.display_name || ''),
                    place_id: address.place_id?.trim() || null
               } : null
          };
     },

     /**
      * Validates update user profile request
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateUpdateProfile(data) {
          const { name, phone, gender, dob, photo } = data;
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
               if (!helpers.isValidPhone(phone)) {
                    errors.push({ field: 'phone', message: MESSAGES.INVALID_PHONE });
               } else {
                    sanitizedData.phone = helpers.sanitizePhone(phone);
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

          // Validate photo (optional)
          if (photo !== undefined) {
               if (photo && !helpers.isValidURL(photo) && !photo.startsWith('/')) {
                    errors.push({ field: 'photo', message: 'Invalid photo URL format' });
               } else {
                    sanitizedData.photo = photo ? photo.trim() : null;
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          if (Object.keys(sanitizedData).length === 0) {
               throw new AppError('No valid fields to update', HTTP_STATUS.BAD_REQUEST);
          }

          return sanitizedData;
     },

     /**
      * Validates user license information update
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateLicenseInfo(data) {
          const { license_number, license_status, expire_date, experience } = data;
          const errors = [];

          // Validate license number
          if (!license_number || typeof license_number !== 'string') {
               errors.push({ field: 'license_number', message: 'License number is required' });
          } else if (!helpers.isValidLength(license_number, 5, 20)) {
               errors.push({ field: 'license_number', message: MESSAGES.INVALID_LICENSE });
          }

          // Validate license status (optional)
          if (license_status && !helpers.isValidEnum(license_status, ENUMS.LICENSE_STATUS)) {
               errors.push({ field: 'license_status', message: `License status must be one of: ${ENUMS.LICENSE_STATUS.join(', ')}` });
          }

          // Validate expire date
          if (!expire_date) {
               errors.push({ field: 'expire_date', message: 'License expiry date is required' });
          } else if (!helpers.isValidDate(expire_date)) {
               errors.push({ field: 'expire_date', message: MESSAGES.INVALID_DATE });
          }

          // Validate experience (optional)
          if (experience !== undefined) {
               const exp = parseInt(experience);
               if (isNaN(exp) || exp < 0 || exp > 50) {
                    errors.push({ field: 'experience', message: 'Experience must be between 0 and 50 years' });
               }
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return {
               license_number: license_number.trim().toUpperCase(),
               license_status: license_status || 'pending',
               expire_date: helpers.formatDate(expire_date),
               experience: experience !== undefined ? parseInt(experience) : null
          };
     },

     /**
      * Validates NID update
      * @param {Object} data - Request body data
      * @returns {Object} - Validated and sanitized data
      * @throws {AppError} - If validation fails
      */
     validateNIDUpdate(data) {
          const { nid } = data;
          const errors = [];

          if (!nid) {
               errors.push({ field: 'nid', message: 'NID is required' });
          } else if (!helpers.isValidNID(nid)) {
               errors.push({ field: 'nid', message: MESSAGES.INVALID_NID });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return { nid: nid.trim() };
     },

     /**
      * Validates user ID parameter
      * @param {string} id - User ID to validate
      * @returns {string} - Validated ID
      * @throws {AppError} - If validation fails
      */
     validateUserId(id) {
          if (!id || typeof id !== 'string' || id.trim() === '') {
               throw new AppError(MESSAGES.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
          }
          return id.trim();
     },

     /**
      * Validates email parameter
      * @param {string} email - Email to validate
      * @returns {string} - Validated email
      * @throws {AppError} - If validation fails
      */
     validateEmail(email) {
          if (!email || !helpers.isValidEmail(email)) {
               throw new AppError(MESSAGES.INVALID_EMAIL, HTTP_STATUS.BAD_REQUEST);
          }
          return email.toLowerCase().trim();
     },

     /**
      * Validates account status update
      * @param {Object} data - Request body data
      * @returns {Object} - Validated data
      * @throws {AppError} - If validation fails
      */
     validateAccountStatus(data) {
          const { accountstatus } = data;
          const errors = [];

          if (!accountstatus) {
               errors.push({ field: 'accountstatus', message: 'Account status is required' });
          } else if (!helpers.isValidEnum(accountstatus, ENUMS.ACCOUNT_STATUS)) {
               errors.push({ field: 'accountstatus', message: `Account status must be one of: ${ENUMS.ACCOUNT_STATUS.join(', ')}` });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return { accountstatus };
     },

     /**
      * Validates user role update
      * @param {Object} data - Request body data
      * @returns {Object} - Validated data
      * @throws {AppError} - If validation fails
      */
     validateUserRole(data) {
          const { userrole } = data;
          const errors = [];

          if (!userrole) {
               errors.push({ field: 'userrole', message: 'User role is required' });
          } else if (!helpers.isValidEnum(userrole, ENUMS.USER_ROLE)) {
               errors.push({ field: 'userrole', message: `User role must be one of: ${ENUMS.USER_ROLE.join(', ')}` });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return { userrole };
     },

     /**
      * Validates address object
      * @param {Object} address - Address data
      * @param {boolean} throwError - Whether to throw error or return errors
      * @returns {Array} - Array of validation errors
      */
     validateAddress(address, throwError = true) {
          const errors = [];

          if (address.city && !helpers.isValidLength(address.city, 2, 30)) {
               errors.push({ field: 'address.city', message: 'City must be between 2 and 30 characters' });
          }

          if (address.area && !helpers.isValidLength(address.area, 2, 150)) {
               errors.push({ field: 'address.area', message: 'Area must be between 2 and 150 characters' });
          }

          if (address.postcode && !helpers.isValidLength(address.postcode, 4, 20)) {
               errors.push({ field: 'address.postcode', message: MESSAGES.INVALID_POSTCODE });
          }

          if (address.latitude !== undefined && address.latitude !== null) {
               if (!helpers.isValidLatitude(parseFloat(address.latitude))) {
                    errors.push({ field: 'address.latitude', message: MESSAGES.INVALID_COORDINATES });
               }
          }

          if (address.longitude !== undefined && address.longitude !== null) {
               if (!helpers.isValidLongitude(parseFloat(address.longitude))) {
                    errors.push({ field: 'address.longitude', message: MESSAGES.INVALID_COORDINATES });
               }
          }

          if (throwError && errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          return errors;
     },

     /**
      * Validates address update
      * @param {Object} data - Address data
      * @returns {Object} - Validated and sanitized address data
      * @throws {AppError} - If validation fails
      */
     validateAddressUpdate(data) {
          const { city, area, postcode, latitude, longitude, display_name, place_id } = data;
          const errors = [];

          if (city && !helpers.isValidLength(city, 2, 30)) {
               errors.push({ field: 'city', message: 'City must be between 2 and 30 characters' });
          }

          if (area && !helpers.isValidLength(area, 2, 150)) {
               errors.push({ field: 'area', message: 'Area must be between 2 and 150 characters' });
          }

          if (postcode && !helpers.isValidLength(postcode, 4, 20)) {
               errors.push({ field: 'postcode', message: MESSAGES.INVALID_POSTCODE });
          }

          if (latitude !== undefined && !helpers.isValidLatitude(parseFloat(latitude))) {
               errors.push({ field: 'latitude', message: MESSAGES.INVALID_COORDINATES });
          }

          if (longitude !== undefined && !helpers.isValidLongitude(parseFloat(longitude))) {
               errors.push({ field: 'longitude', message: MESSAGES.INVALID_COORDINATES });
          }

          if (errors.length > 0) {
               const error = new AppError(MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
               error.errors = errors;
               throw error;
          }

          const sanitizedData = {};
          if (city) sanitizedData.city = helpers.sanitizeString(city);
          if (area) sanitizedData.area = helpers.sanitizeString(area);
          if (postcode) sanitizedData.postcode = postcode.trim();
          if (latitude !== undefined) sanitizedData.latitude = parseFloat(latitude);
          if (longitude !== undefined) sanitizedData.longitude = parseFloat(longitude);
          if (display_name) sanitizedData.display_name = helpers.sanitizeString(display_name);
          if (place_id) sanitizedData.place_id = place_id.trim();

          return sanitizedData;
     }
};

module.exports = userValidator;
