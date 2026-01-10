/**
 * Application Messages Constants
 * Centralized messages for consistency across the application
 */
const MESSAGES = {
     // Success Messages
     AGENCY_OWNER_UPDATED: 'Owner information updated successfully',
     USER_CREATED: 'User created successfully',
     USER_UPDATED: 'User updated successfully',
     CAR_CREATED: 'Car added successfully',
     CAR_UPDATED: 'Car updated successfully',
     BIKE_CREATED: 'Bike added successfully',
     BIKE_UPDATED: 'Bike updated successfully',
     BOOKING_CREATED: 'Booking created successfully',
     BOOKING_UPDATED: 'Booking updated successfully',
     BOOKING_CANCELLED: 'Booking cancelled successfully',
     DRIVER_CREATED: 'Driver registered successfully',
     DRIVER_UPDATED: 'Driver updated successfully',
     REVIEW_ADDED: 'Review added successfully',
     PAYMENT_SUCCESS: 'Payment processed successfully',
     AGENCY_CREATED: 'Agency created successfully',
     AGENCY_UPDATED: 'Agency updated successfully',
     
     // Validation Messages
     VALIDATION_ERROR: 'Validation failed',
     INVALID_ID: 'Invalid ID provided',
     MISSING_REQUIRED_FIELDS: 'Missing required fields',

     // Error Messages
     USER_NOT_FOUND: 'User not found',
     AGENCY_NOT_FOUND: 'Agency not found',
     CAR_NOT_FOUND: 'Car not found',
     BIKE_NOT_FOUND: 'Bike not found',
     BOOKING_NOT_FOUND: 'Booking not found',
     DRIVER_NOT_FOUND: 'Driver not found',
     UPDATE_FAILED: 'Failed to update information',
     INTERNAL_ERROR: 'An internal server error occurred',
     DUPLICATE_EMAIL: 'Email already exists',
     DUPLICATE_PHONE: 'Phone number already exists',
     DUPLICATE_NID: 'NID already exists',
     VEHICLE_NOT_AVAILABLE: 'Vehicle is not available for the selected dates',
     DRIVER_NOT_AVAILABLE: 'Driver is not available for the selected dates',

     // Field Validation Messages
     INVALID_NAME: 'Name must be between 2 and 30 characters',
     INVALID_PHONE: 'Invalid phone number format',
     INVALID_DOB: 'Invalid date of birth format',
     INVALID_GENDER: 'Gender must be male, female, or other',
     INVALID_EMAIL: 'Invalid email format',
     INVALID_NID: 'NID must be 10 or 13 digits',
     INVALID_LICENSE: 'Invalid license number format',
     INVALID_DATE: 'Invalid date format',
     INVALID_RATING: 'Rating must be between 0 and 5',
     INVALID_PRICE: 'Price must be a positive number',
     INVALID_YEAR: 'Invalid year',
     INVALID_COORDINATES: 'Invalid latitude or longitude',
     INVALID_POSTCODE: 'Invalid postcode format',
     INVALID_IMAGES: 'Images must be an array of URLs',
     INVALID_BOOKING_DATES: 'End date must be after start date',
     INVALID_VEHICLE_TYPE: 'Vehicle type must be car or bike',
     INVALID_STATUS: 'Invalid status value',
     INVALID_TIN: 'TIN must be 12 digits',
     INVALID_INSURANCE: 'Invalid insurance number format',
     REVIEW_TOO_LONG: 'Review must not exceed 1000 characters'
};

module.exports = MESSAGES;
