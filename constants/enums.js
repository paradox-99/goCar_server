/**
 * Application Enums
 * Centralized enum values matching database types
 */

const ENUMS = {
     // User roles
     USER_ROLE: ['user', 'admin', 'agency'],

     // Account status
     ACCOUNT_STATUS: ['active', 'suspended', 'pending', 'deleted'],

     // Agency status
     AGENCY_STATUS: ['active', 'inactive', 'suspended', 'pending'],

     // Car/Bike status
     VEHICLE_STATUS: ['available', 'booked', 'maintenance', 'unavailable'],

     // Booking status
     BOOKING_STATUS: ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'],

     // Vehicle type
     VEHICLE_TYPE: ['car', 'bike'],

     // Damage severity
     DAMAGE_SEVERITY: ['minor', 'moderate', 'severe'],

     // Damage status
     DAMAGE_STATUS: ['reported', 'under_review', 'resolved', 'disputed'],

     // License status
     LICENSE_STATUS: ['valid', 'expired', 'suspended', 'pending'],

     // Payment method
     PAYMENT_METHOD: ['bkash', 'nagad', 'rocket', 'card', 'cash'],

     // Gender
     GENDER: ['male', 'female', 'other'],

     // Fuel type
     FUEL_TYPE: ['petrol', 'diesel', 'octane', 'electric', 'hybrid', 'cng'],

     // Transmission type
     TRANSMISSION_TYPE: ['manual', 'automatic', 'semi-automatic'],

     // Car types
     CAR_TYPE: ['sedan', 'suv', 'hatchback', 'pickup', 'van', 'micro', 'luxury', 'sports'],

     // Bike types
     BIKE_TYPE: ['standard', 'sports', 'cruiser', 'scooter', 'dirt'],

     // Insurance coverage type
     INSURANCE_COVERAGE: ['comprehensive', 'third_party', 'basic'],

     // Engine start type (for bikes)
     ENGINE_START_TYPE: ['kick', 'self', 'both']
};

module.exports = ENUMS;
