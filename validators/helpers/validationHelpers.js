/**
 * Validation Helper Functions
 * Common validation utilities used across all validators
 */

const MESSAGES = require('../../constants/messages');

const validationHelpers = {
     /**
      * Validates email format
      * @param {string} email - Email to validate
      * @returns {boolean}
      */
     isValidEmail(email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email);
     },

     /**
      * Validates Bangladesh phone number format
      * @param {string} phone - Phone number to validate
      * @returns {boolean}
      */
     isValidPhone(phone) {
          const phoneRegex = /^(\+88)?01[0-9]{9}$/;
          return phoneRegex.test(phone.replace(/[\s-]/g, ''));
     },

     /**
      * Validates NID (10 or 13 digits)
      * @param {string} nid - NID to validate
      * @returns {boolean}
      */
     isValidNID(nid) {
          const nidRegex = /^(\d{10}|\d{13})$/;
          return nidRegex.test(nid);
     },

     /**
      * Validates date string
      * @param {string} dateStr - Date string to validate
      * @returns {boolean}
      */
     isValidDate(dateStr) {
          const date = new Date(dateStr);
          return !isNaN(date.getTime());
     },

     /**
      * Validates date is in the future
      * @param {string} dateStr - Date string to validate
      * @returns {boolean}
      */
     isFutureDate(dateStr) {
          const date = new Date(dateStr);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date >= today;
     },

     /**
      * Validates date is in the past
      * @param {string} dateStr - Date string to validate
      * @returns {boolean}
      */
     isPastDate(dateStr) {
          const date = new Date(dateStr);
          const today = new Date();
          return date < today;
     },

     /**
      * Calculates age from date of birth
      * @param {string} dob - Date of birth
      * @returns {number}
      */
     calculateAge(dob) {
          const dobDate = new Date(dob);
          const today = new Date();
          return Math.floor((today - dobDate) / (365.25 * 24 * 60 * 60 * 1000));
     },

     /**
      * Validates gender
      * @param {string} gender - Gender to validate
      * @returns {boolean}
      */
     isValidGender(gender) {
          const validGenders = ['male', 'female', 'other'];
          return validGenders.includes(gender.toLowerCase());
     },

     /**
      * Validates rating (0-5 with one decimal)
      * @param {number} rating - Rating to validate
      * @returns {boolean}
      */
     isValidRating(rating) {
          return typeof rating === 'number' && rating >= 0 && rating <= 5;
     },

     /**
      * Validates positive integer
      * @param {number} num - Number to validate
      * @returns {boolean}
      */
     isPositiveInteger(num) {
          return Number.isInteger(num) && num > 0;
     },

     /**
      * Validates non-negative integer
      * @param {number} num - Number to validate
      * @returns {boolean}
      */
     isNonNegativeInteger(num) {
          return Number.isInteger(num) && num >= 0;
     },

     /**
      * Validates latitude (-90 to 90)
      * @param {number} lat - Latitude to validate
      * @returns {boolean}
      */
     isValidLatitude(lat) {
          return typeof lat === 'number' && lat >= -90 && lat <= 90;
     },

     /**
      * Validates longitude (-180 to 180)
      * @param {number} lng - Longitude to validate
      * @returns {boolean}
      */
     isValidLongitude(lng) {
          return typeof lng === 'number' && lng >= -180 && lng <= 180;
     },

     /**
      * Validates year (reasonable range for vehicles)
      * @param {number} year - Year to validate
      * @returns {boolean}
      */
     isValidBuildYear(year) {
          const currentYear = new Date().getFullYear();
          return Number.isInteger(year) && year >= 1990 && year <= currentYear + 1;
     },

     /**
      * Validates TIN (12 digits)
      * @param {string} tin - TIN to validate
      * @returns {boolean}
      */
     isValidTIN(tin) {
          const tinRegex = /^\d{12}$/;
          return tinRegex.test(tin);
     },

     /**
      * Validates URL format
      * @param {string} url - URL to validate
      * @returns {boolean}
      */
     isValidURL(url) {
          try {
               new URL(url);
               return true;
          } catch {
               return false;
          }
     },

     /**
      * Validates array of URLs (images)
      * @param {Array} images - Array of image URLs
      * @returns {boolean}
      */
     isValidImageArray(images) {
          if (!Array.isArray(images)) return false;
          return images.every(img => typeof img === 'string' && (this.isValidURL(img) || img.startsWith('/')));
     },

     /**
      * Sanitizes string (trim and remove extra spaces)
      * @param {string} str - String to sanitize
      * @returns {string}
      */
     sanitizeString(str) {
          if (typeof str !== 'string') return '';
          return str.trim().replace(/\s+/g, ' ');
     },

     /**
      * Sanitizes phone number (remove spaces and dashes)
      * @param {string} phone - Phone to sanitize
      * @returns {string}
      */
     sanitizePhone(phone) {
          if (typeof phone !== 'string') return '';
          return phone.replace(/[\s-]/g, '');
     },

     /**
      * Formats date to ISO string (date only)
      * @param {string} dateStr - Date string to format
      * @returns {string}
      */
     formatDate(dateStr) {
          return new Date(dateStr).toISOString().split('T')[0];
     },

     /**
      * Formats datetime to ISO string
      * @param {string} dateStr - DateTime string to format
      * @returns {string}
      */
     formatDateTime(dateStr) {
          return new Date(dateStr).toISOString();
     },

     /**
      * Validates string length
      * @param {string} str - String to validate
      * @param {number} min - Minimum length
      * @param {number} max - Maximum length
      * @returns {boolean}
      */
     isValidLength(str, min, max) {
          if (typeof str !== 'string') return false;
          const length = str.trim().length;
          return length >= min && length <= max;
     },

     /**
      * Validates enum value
      * @param {string} value - Value to validate
      * @param {Array} allowedValues - Array of allowed values
      * @returns {boolean}
      */
     isValidEnum(value, allowedValues) {
          return allowedValues.includes(value);
     }
};

module.exports = validationHelpers;
