import crypto from 'crypto';

export function createUserId() {
     const prefix = "USER-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function createAddressId() {
     const prefix = "Add-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function createAgencyId() {
     const prefix = "AG-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function createDriverId() {
     const prefix = "DRI-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function generatePaymentId() {
     const prefix = "PAY-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function generateBookingId() {
     const prefix = "BOOK-";
     const uniqueNumber = Date.now() + Math.floor(Math.random() * 1000); // ensures uniqueness
     return `${prefix}${uniqueNumber}`;
}

export function generateTransactionId() {
     const prefix = "TRX";
     const timestamp = Date.now();
     const randomValue = crypto.randomBytes(4).toString("hex"); // Generates a random 8-character hex string
     return `${prefix}_${timestamp}${randomValue}`;
}