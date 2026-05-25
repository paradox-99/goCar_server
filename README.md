# GoCar Server

Backend API for **GoCar** — a vehicle rental platform for Bangladesh supporting car and bike rentals with multi-role user management, booking workflows, payment processing, and admin dashboards.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Cars](#car-endpoints)
  - [Bikes](#bike-endpoints)
  - [Agencies](#agency-endpoints)
  - [Drivers](#driver-endpoints)
  - [Bookings](#booking-endpoints)
  - [Payments](#payment-endpoints)
  - [Reviews](#review-endpoints)
  - [Notifications](#notification-endpoints)
  - [Damage & Return Reports](#damage--return-reports)
  - [File Upload](#file-upload-endpoints)
  - [Admin](#admin-endpoints)
  - [Agency Dashboard](#agency-dashboard-endpoints)
  - [Driver Trips](#driver-trip-endpoints)
- [Error Handling](#error-handling)
- [Scripts](#scripts)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4.21 |
| Database | PostgreSQL (via `pg` pool) |
| Authentication | JWT (15-day cookie tokens) |
| Password Hashing | bcryptjs |
| File Storage | AWS S3 (SigV4 presigned URLs) |
| Payment Gateway | SSLCommerz |
| Email | Mailjet |
| Rate Limiting | express-rate-limit (100 req / 15 min) |

---

## Project Structure

```
goCar_server/
├── index.js                  # HTTP server entry point
├── app.js                    # Express app, middleware, route mounting
├── goCar_Schema.sql          # Full PostgreSQL schema
├── config/
│   ├── db.js                 # PostgreSQL connection pool
│   ├── jwt.js                # Token generation & role-based auth middleware
│   └── s3.js                 # AWS S3 presigned URL & upload helpers
├── routes/                   # One file per resource domain
├── controllers/              # Request handlers (one per domain/role)
├── services/                 # Database operations & business logic
├── validators/               # Input validation & sanitization
├── middleware/
│   ├── errorHandler.js       # Global error handler + 404 handler
│   └── validateRequest.js    # Validation middleware factory
├── constants/
│   ├── enums.js              # All platform enum values
│   ├── httpStatus.js         # HTTP status code constants
│   └── messages.js           # Success & error message strings
└── utils/
    ├── AppError.js           # Custom operational error class
    ├── asyncHandler.js       # Async route handler wrapper
    └── adminLogger.js        # Admin audit log writer
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up the database
psql -U <user> -d <database> -f goCar_Schema.sql

# Start the server
npm start
```

The server starts on `PORT` (default `3000`). All API routes are prefixed with `/api`.

---



## Database Schema

The PostgreSQL database (`goCar`) contains the following tables:

### Core Tables

| Table | Description |
|---|---|
| `users` | All registered users (customers, admins, agency owners) |
| `driver_info` | Driver-specific data linked to a user and agency |
| `agencies` | Rental agency profiles with owner and address references |
| `address` | Shared address table with lat/long geography |
| `cars` | Car inventory per agency |
| `cars_documentation` | Car license, insurance, and fitness certificate records |
| `bikes` | Bike inventory per agency |
| `motorbike_documentation` | Bike license and insurance records |
| `booking_info` | Booking records linking users, vehicles, drivers, agencies |
| `payment_info` | Payment transactions linked to bookings |
| `pickup_info` | Pickup form data (fuel level, odometer, fees) |
| `return_info` | Return form data (fuel level, odometer, late/fuel/cleaning charges) |
| `damage_reports` | Damage reports with severity, status, photos, estimated cost |
| `driver_trip_assignments` | Trip requests sent to drivers with accept/decline response |
| `cars_reviews` | Car reviews submitted by users after bookings |
| `motorbike_reviews` | Bike reviews |
| `driver_reviews` | Driver reviews |
| `agency_reviews` | Agency reviews |
| `favourite_cars` | User favourite vehicles (composite PK: user_id + car_id) |
| `notifications` | User notifications with read status |
| `admin_activity_log` | Full audit trail of admin actions |
| `platform_settings` | Key-value config store (JSONB) |

### Enums

| Enum | Values |
|---|---|
| `user_role` | user, admin, agency, driver |
| `account_status` | active, suspended, pending, deleted |
| `agency_status` | active, inactive, suspended, pending |
| `car_status` | available, booked, maintenance, unavailable |
| `booking_status` | pending, confirmed, ongoing, completed, cancelled |
| `damage_severity` | minor, moderate, severe |
| `damage_status` | reported, under_review, resolved, disputed |
| `license_status` | valid, expired, suspended, pending |
| `payment_method` | bkash, nagad, rocket, card, cash |
| `vehicle_type` | car, bike |
| `assignment_status` | pending, confirmed, cancelled_by_driver, cancelled_by_agency |

---

## Authentication & Authorization

JWTs are issued as HTTP-only cookies on login and expire after **15 days**.

Four role-based middleware guards are exported from `config/jwt.js`:

| Middleware | Allowed Role |
|---|---|
| `verifyUser` | user |
| `verifyAgency` | agency |
| `verifyDriver` | driver |
| `verifyAdmin` | admin |

`verifyRole(allowedRoles)` is the underlying factory — pass an array of roles to allow multiple.

---

## API Reference

All routes are mounted under `/api`. Protected routes require a valid JWT cookie.

---

### Authentication Endpoints

`/api/authorization`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/jwt` | — | Login — validates credentials and sets JWT cookie |
| POST | `/logout` | — | Clears the JWT cookie |

---

### User Endpoints

`/api/userRoute`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/createUser` | — | Register a new user |
| GET | `/getUserRole/:email` | — | Get a user's role |
| GET | `/getUserInfo/:email` | User | Get user profile info |
| PATCH | `/updateUserInfo/:userId` | User | Update name, photo, gender, phone, license, experience |
| PATCH | `/updateUserAddress/:userId` | User | Update user address |
| GET | `/dashboard-stats/:userId` | User | Booking and spending stats for user dashboard |
| GET | `/users` | Admin | List all users |
| GET | `/users/admin` | Admin | Filtered user list |
| GET | `/users/admin/details/:userId` | Admin | Full user details |
| PATCH | `/users/admin/update/:userId` | Admin | Admin update user |
| GET | `/user-by-id/:id` | Admin | Get user by ID |
| GET | `/getBookings/:id` | Admin | Get bookings for a specific user |

---

### Car Endpoints

`/api/carRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/showAllCars` | — | List all available cars |
| GET | `/getCarDetails/:id` | — | Get car details |
| GET | `/getCarReviews/:id` | — | Get reviews for a car |
| GET | `/carByBrand/:brand` | — | Filter cars by brand |
| GET | `/carByType/:type` | — | Filter cars by type |
| GET | `/getSearchData` | — | Query-based car search |
| GET | `/getCarByLocation` | — | Location-based car search |
| GET | `/showAgencyCars/:id` | Agency | Cars owned by an agency |
| GET | `/agencyActiveBookingCars/:id` | Agency | Agency cars currently booked |
| POST | `/addCar` | Agency | Add a new car to fleet |
| PATCH | `/updateCarInfo/:id` | Agency | Update car status, price, or description |
| POST | `/addFavourite` | User | Add a car to favourites |
| DELETE | `/removeFavourite` | User | Remove a car from favourites |
| DELETE | `/clearFavourites/:userId` | User | Clear all favourites |
| GET | `/getFavourites/:userId` | User | Get user's favourite cars |
| GET | `/checkFavourite/:userId/:carId` | User | Check if a car is favourited |

---

### Bike Endpoints

`/api/bikeRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/showAllBikes` | — | List all bikes |
| GET | `/getBikeDetails/:id` | — | Get bike details |
| GET | `/getBikeReviews/:id` | — | Get reviews for a bike |
| GET | `/bikeByBrand/:brand` | — | Filter bikes by brand |
| POST | `/addBike` | Agency | Add a new bike to fleet |

---

### Agency Endpoints

`/api/agencyRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/getAllAgency` | — | List all agencies |
| GET | `/getAgencyDetails/:id` | — | Get agency profile |
| GET | `/getAgencyOwner/:id` | — | Get agency owner info |
| GET | `/getAgencyProfile/:email` | Agency | Agency's own profile |
| GET | `/getAgencyCarsByOwner/:email` | Agency | Agency's fleet |
| GET | `/getAgencyBookingsByEmail/:email` | Agency | Bookings by owner email |
| GET | `/getBookingsByAgencyId/:agencyId` | Agency | Bookings by agency ID |
| GET | `/getAllBookings` | Agency | All bookings for the agency |
| PATCH | `/updateOwnerInfo/:id` | Agency | Update owner personal info |
| PATCH | `/updateAgencyInfo/:id` | Agency | Update agency business info |
| GET | `/reviews/stats/:agencyId` | Agency | Aggregated review stats |
| GET | `/reviews/vehicles/:agencyId` | Agency | Reviews for agency vehicles |
| GET | `/reviews/agency/:agencyId` | Agency | Reviews for the agency |
| GET | `/reviews/drivers/:agencyId` | Agency | Reviews for agency drivers |
| GET | `/admin/filtered` | Admin | Filtered agency list |
| GET | `/admin/details/:agencyId` | Admin | Full agency details |
| PATCH | `/admin/update/:agencyId` | Admin | Admin update agency |
| GET | `/admin/cities` | Admin | List cities with agencies |

---

### Driver Endpoints

`/api/driverRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/driverList` | — | Public driver listing |
| GET | `/checkNID/:nid` | — | Check if NID is already registered |
| GET | `/checkPhone/:phone` | — | Check if phone is already registered |
| GET | `/checkLicense/:license_number` | — | Check if license is already registered |
| POST | `/createDriver` | Agency | Register a new driver |
| GET | `/profile/:email` | Driver | Driver's own profile |
| GET | `/agencyDrivers/:email` | Agency | List drivers under the agency |
| PATCH | `/availability/:driverId` | Driver | Update availability status |
| PATCH | `/suspend/:driverId` | Agency | Suspend a driver |
| PATCH | `/remove-from-agency/:driverId` | Agency | Remove driver from agency |
| GET | `/admin-all-drivers` | Admin | List all drivers |
| GET | `/profile-by-id/:id` | Admin | Driver details by ID |
| PATCH | `/verify/:driverId` | Admin | Verify a driver |
| PATCH | `/updateDriverInfo/:driverId` | Admin | Admin update driver info |

`/api/driverProfile`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/full/:email` | Driver | Full driver profile |
| GET | `/reviews/:driverId` | Driver | Reviews received |
| PATCH | `/personal/:driverId` | Driver | Update personal info |
| PATCH | `/address/:driverId` | Driver | Update address |
| PATCH | `/license/:driverId` | Driver | Update license info |
| PATCH | `/photo/:driverId` | Driver | Update profile photo |
| PATCH | `/deactivate/:driverId` | Driver | Deactivate account |

---

### Booking Endpoints

`/api/bookingRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/createBooking` | User | Create a new booking |
| POST | `/checkAvailability` | User | Check vehicle availability for dates |
| GET | `/getUserBookings/:id` | User | Get all bookings for a user |
| GET | `/getBooking/:id` | User | Get a specific booking |
| GET | `/getCarBookings/:id` | Agency | Bookings for a specific car |
| GET | `/getDriverBookings/:id` | Driver | Bookings assigned to a driver |
| PUT | `/cancelBooking/:id` | User | Cancel a booking |
| PATCH | `/updateStatus/:id` | Agency | Update booking status |
| GET | `/admin/filtered` | Admin | Filtered booking list |
| GET | `/admin/stats` | Admin | Booking statistics |
| GET | `/admin/details/:id` | Admin | Full booking details |
| PATCH | `/admin/update/:id` | Admin | Admin update booking |

`/api/pickupRoutes` and `/api/returnRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create` | Agency | Create pickup / return form |
| GET | `/booking/:bookingId` | — | Get pickup or return details |
| PATCH | `/confirm/:bookingId` | User | User confirms pickup / return |

---

### Payment Endpoints

`/api/paymentRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payment` | User | Initiate SSLCommerz payment |
| POST | `/payment/success/:trx_id` | — | SSLCommerz success callback |
| POST | `/paymentFail/:tran_id` | — | SSLCommerz failure callback |
| GET | `/getPaymentInfo/:tran_id` | User | Get payment transaction details |
| GET | `/paymentHistory` | Admin | All payment history |
| GET | `/admin/filtered` | Admin | Filtered payment list |
| GET | `/admin/stats` | Admin | Payment statistics |
| GET | `/admin/details/:id` | Admin | Payment detail |
| GET | `/admin/analytics` | Admin | Revenue analytics |

---

### Review Endpoints

`/api/reviewRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/vehicle` | User | Submit a vehicle review |
| POST | `/driver` | User | Submit a driver review |
| POST | `/agency` | User | Submit an agency review |
| POST | `/booking` | User | Submit a review for a booking |
| GET | `/check/:bookingId` | User | Check if a review exists for a booking |
| GET | `/user/:userId` | User | Reviews written by a user |
| GET | `/received/:targetType/:targetId` | — | Reviews received by a vehicle/driver/agency |
| GET | `/admin/stats` | Admin | Review statistics |
| GET | `/admin/list` | Admin | All reviews |
| GET | `/admin/:type/:reviewId` | Admin | Review details |
| GET | `/admin/analytics` | Admin | Review analytics |

---

### Notification Endpoints

`/api/notificationRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | — | Create a notification |
| GET | `/user/:userId` | User | Get all notifications for a user |
| GET | `/unread/:userId` | User | Get unread notifications |
| PATCH | `/:notifId/read` | User | Mark a notification as read |
| GET | `/all` | Admin | All notifications |
| GET | `/admin/stats` | Admin | Notification statistics |
| GET | `/admin/list` | Admin | Notification list |
| POST | `/admin/send` | Admin | Broadcast notifications |
| DELETE | `/admin/delete-bulk` | Admin | Bulk delete notifications |
| GET | `/admin/analytics` | Admin | Notification analytics |
| GET | `/admin/search-recipients` | Admin | Search notification recipients |

---

### Damage & Return Reports

`/api/returnDamageRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/pickup` | Agency | Report vehicle pickup condition |
| POST | `/return` | Agency | Report vehicle return condition |
| POST | `/damage` | Agency | Report vehicle damage |
| POST | `/user-damage` | User | User-submitted damage report |
| GET | `/user-reports/:userId` | User | Get user's damage reports |
| GET | `/agency-reports/:agencyId` | Agency | Get agency's damage reports |
| PATCH | `/damage-status/:damageId` | Agency | Update damage report status |

`/api/agencyDamage`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats/:agencyId` | Agency | Damage statistics |
| GET | `/list/:agencyId` | Agency | Damage list |
| GET | `/detail/:damageId` | Agency | Damage detail |
| PATCH | `/update/:damageId` | Agency | Update a damage report |
| PATCH | `/bulk-update` | Agency | Bulk update damage reports |
| POST | `/charge/:damageId` | Agency | Charge user for damage |
| GET | `/repeat-vehicles/:agencyId` | Agency | Vehicles with repeated damage |
| GET | `/filter-options/:agencyId` | Agency | Available filter values |

---

### File Upload Endpoints

`/api/uploadRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/presign` | — | Get a presigned S3 PUT URL for direct browser upload |
| POST | `/upload` | — | Upload a file via the server to S3 |

---

### Admin Endpoints

**Address** — `/api/addressRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:addressId` | — | Get address by ID |
| PATCH | `/updateAddress/:addressId` | — | Update address |
| GET | `/admin/stats` | Admin | Address statistics |
| GET | `/admin/list` | Admin | Address list |
| GET | `/admin/map` | Admin | Addresses for map view |
| GET | `/admin/cities` | Admin | List of cities |
| DELETE | `/admin/delete-bulk` | Admin | Bulk delete addresses |

**Analytics** — `/api/admin-analytics`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/revenue` | Admin | Revenue analytics |
| GET | `/bookings` | Admin | Booking analytics |
| GET | `/cancellations` | Admin | Cancellation analytics |
| GET | `/drivers` | Admin | Driver analytics |
| GET | `/agencies` | Admin | Agency analytics |
| GET | `/vehicles` | Admin | Vehicle analytics |

**Dashboard** — `/api/admin-dashboard`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin-info` | Admin | Logged-in admin info |
| GET | `/stats` | Admin | Platform-wide stats summary |
| GET | `/revenue-chart` | Admin | Revenue chart data |
| GET | `/recent-bookings` | Admin | Latest bookings |
| GET | `/recent-damage` | Admin | Latest damage reports |
| GET | `/recent-notifications` | Admin | Latest notifications |
| GET | `/upcoming-bookings` | Admin | Upcoming bookings |
| GET | `/top-performers` | Admin | Top agencies and drivers |
| GET | `/revenue-by-method` | Admin | Revenue split by payment method |
| GET | `/search` | Admin | Global search |
| GET | `/calendar` | Admin | Booking calendar data |

**Damage** — `/api/admin-damage`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Admin | Platform damage statistics |
| GET | `/list` | Admin | All damage reports |
| GET | `/detail/:id` | Admin | Damage report detail |
| PUT | `/update/:id` | Admin | Update a damage report |
| GET | `/analytics` | Admin | Damage analytics |

**Vehicles** — `/api/adminVehicleRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cars` | Admin | All cars |
| GET | `/bikes` | Admin | All bikes |
| GET | `/car-details/:id` | Admin | Car details |
| GET | `/bike-details/:id` | Admin | Bike details |
| PATCH | `/update-car/:id` | Admin | Update car status |
| PATCH | `/update-bike/:id` | Admin | Update bike status |

**License** — `/api/licenseRoutes`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin | License statistics |
| GET | `/admin/list` | Admin | License list |
| GET | `/admin/analytics` | Admin | License analytics |
| PATCH | `/admin/update` | Admin | Update a license |
| PATCH | `/admin/bulk-update` | Admin | Bulk update licenses |

**Verification** — `/api/verification`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Admin | Verification statistics |
| GET | `/list` | Admin | Verification list |

**Settings** — `/api/admin-settings`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Admin | Admin profile |
| PUT | `/profile` | Admin | Update admin profile |
| PUT | `/password` | Admin | Change admin password |
| PUT | `/notification-preferences` | Admin | Update notification preferences |
| GET | `/activity-log` | Admin | Admin audit log |
| GET | `/admins` | Admin | List all admins |
| PUT | `/admins/:id` | Admin | Update an admin |
| GET | `/platform` | Admin | Platform settings |
| PUT | `/platform` | Admin | Update platform settings |

---

### Agency Dashboard Endpoints

`/api/agencyDashboard`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats/:agencyId` | Agency | Summary stats |
| GET | `/revenue-trend/:agencyId` | Agency | Revenue over time |
| GET | `/bookings/:agencyId` | Agency | Booking data |
| GET | `/fleet/:agencyId` | Agency | Fleet status |
| GET | `/drivers/:agencyId` | Agency | Driver overview |
| GET | `/damage/:agencyId` | Agency | Damage summary |
| GET | `/reviews/:agencyId` | Agency | Review summary |

---

### Driver Trip Endpoints

`/api/driverTrips`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats/:driverId` | Driver | Trip statistics |
| GET | `/banners/:driverId` | Driver | Dashboard banners |
| GET | `/list/:driverId` | Driver | Trip history |
| GET | `/detail/:bookingId` | Driver | Trip detail |
| GET | `/earnings/:driverId` | Driver | Earnings breakdown |
| GET | `/requests/:driverId` | Driver | Pending trip requests |
| POST | `/requests/:assignmentId/respond` | Driver | Accept or decline a trip request |

---

## Error Handling

All errors are handled centrally in `middleware/errorHandler.js`.

**Operational errors** use `AppError(message, statusCode)` and are forwarded through `asyncHandler` wrappers.

**PostgreSQL error codes** are automatically translated:

| PG Code | Meaning | HTTP Status |
|---|---|---|
| 23505 | Unique constraint violation | 409 Conflict |
| 23503 | Foreign key violation | 400 Bad Request |
| 23502 | Not-null violation | 400 Bad Request |
| 22P02 | Invalid type input | 400 Bad Request |

Unhandled errors return `500 Internal Server Error`.

**Response shape:**

```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

---

## Scripts

```bash
npm start    # Start the server (node index.js)
```
