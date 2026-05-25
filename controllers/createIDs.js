const crypto = require('crypto');

function createUserId() {
     const prefix = "USER-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function createAddressId() {
     const prefix = "ADD-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function createAgencyId() {
     const prefix = "AG-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function createDriverId() {
     const prefix = "DRI-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function generatePaymentId() {
     const prefix = "PAY-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function generateBookingId() {
     const prefix = "BOOK-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function generateTransactionId() {
     const prefix = "TRX";
     const timestamp = Date.now();
     const randomValue = crypto.randomBytes(4).toString("hex"); // Generates a random 8-character hex string
     return `${prefix}_${timestamp}${randomValue}`;
}

function generateNotificationId() {
     const prefix = "NOTIF-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

function generateDamageId() {
     const prefix = "DMG-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000);
     return `${prefix}${uniqueNumber}`;
}

module.exports = {
     createUserId,
     createAddressId,
     createAgencyId,
     createDriverId,
     generatePaymentId,
     generateBookingId,
     generateTransactionId,
     generateNotificationId,
     generateDamageId,
};