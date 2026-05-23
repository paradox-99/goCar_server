const pool = require('../config/db');
const agencyService = require('../services/agencyService');
const agencyValidator = require('../validators/agencyValidator');
const asyncHandler = require('../utils/asyncHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');

const getAllAgency = async (req, res) => {
     const query = `
          Select agencies.agency_id, agencies.agency_name, agencies.cars, agencies.bikes, agencies.rating, agencies.review_count, address.display_name 
          from agencies
          join address
          on agencies.address_id = address.address_id
          where agencies.status = 'Active' and agencies.verified = true
     `
     try {
          const results = await pool.query(query);
          res.json(results.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyProfile = async (req, res) => {
     const userEmail = req.params.email;
     const query = `
          SELECT ag.agency_id, ag.agency_name, ag.phone_number, ag.email, ag.cars, ag.license, ag.tin, ag.insurancenumber, ag.tradelicenseexpire, ag.status, ag.expire_date, ag.bikes, ag.verified, u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.photo as owner_photo, u.user_id as owner_id, u.gender, u.dob, u.verified as owner_verified, u.accountstatus, ada.address_id as agency_add_id, ada.city as agency_city, ada.area as agency_area, ada.postcode as agency_postcode, ada.display_name as agency_full_address, adu.address_id as owner_add_id, adu.city as owner_city, adu.area as owner_area, adu.postcode as owner_postcode, adu.display_name as owner_full_address
          FROM agencies as ag
          JOIN users as u ON ag.owner_id = u.user_id
          JOIN address as ada ON ag.address_id = ada.address_id
          JOIN address as adu ON u.address_id = adu.address_id
          WHERE u.email = $1
     `

     try {
          const result = await pool.query(query, [userEmail]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

// agency details by user query
const getAgencyDetails = async (req, res) => {
     const agencyId = req.params.id;
     const query = `
          SELECT agencies.agency_id, agencies.agency_name, agencies.phone_number, agencies.email, agencies.cars, agencies.bikes, agencies.rating, agencies.rating_count, agencies.review_count, agencies.verified, agencies.status, address.display_name, address.display_name as agency_address, address.latitude, address.longitude
          FROM agencies
          JOIN address ON agencies.address_id = address.address_id
          WHERE agencies.agency_id = $1
     `

     try {
          const result = await pool.query(query, [agencyId]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

// agency details by owner query
const getAgencyBookings = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT booking_info.*, cars.brand, cars.model, users.name, users.email, agencies.agency_name
          JOIN users ON booking_info.user_id = users.user_id
          JOIN agencies ON cars.agency_id = agencies.agency_id
          WHERE agencies.owner_id = $1
          ORDER BY booking_info.booking_ts DESC`
     

     try {
          const result = await pool.query(query, [ownerId]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyOwner = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT name
          FROM users
          WHERE user_id = $1
     `
     try {
          const result = await pool.query(query, [ownerId]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAllBookings = async (req, res) => {
     const query = `
          SELECT booking_info.*, cars.brand, cars.model, users.name, users.email, agencies.agency_Name
          FROM (((booking_info
          JOIN users ON booking_info.user_id = users.user_id)
          JOIN cars ON booking_info.vehicle_id = cars.car_id)
          JOIN agencies ON cars.agency_id = agencies.agency_id)
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyCarsByOwner = async (req, res) => {
     const email = req.params.email;
     const query = `
          SELECT cars.*
          FROM (( users
          JOIN agencies ON users.user_id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id) 
          WHERE users.email = $1
     `
     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}


const getAgencyActiveBookingCars = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT cars.brand, cars.model, booking_info.*
          FROM (((users
          JOIN agencies ON users.user_id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          JOIN booking_info ON cars.car_id = booking_info.vehicle_id)
          WHERE users.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyBookingsByEmail = async (req, res) => {
     const email = req.params.email;
     const query = `
          SELECT 
               booking_info.*, 
               cars.brand, 
               cars.model, 
               cars.images,
               users.name as user_name, 
               users.email as user_email, 
               users.phone as user_phone,
               agencies.agency_name
          FROM booking_info
          JOIN users ON booking_info.user_id = users.user_id
          JOIN cars ON booking_info.vehicle_id = cars.car_id
          JOIN agencies ON cars.agency_id = agencies.agency_id
          JOIN users as owners ON agencies.owner_id = owners.user_id
          WHERE owners.email = $1
          ORDER BY booking_info.booking_ts DESC
     `
     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyBookingsByAgencyId = async (req, res) => {
     const { agencyId } = req.params;

     // Validate agency ID
     if (!agencyId || typeof agencyId !== 'string' || agencyId.trim() === '') {
          return res.status(400).json({ error: 'Invalid agency ID' });
     }
     if (!agencyId.startsWith('AG-')) {
          return res.status(400).json({ error: 'Agency ID must start with AG-' });
     }

     const query = `
          SELECT
               bi.*,
               COALESCE(c.brand, b.brand) AS brand,
               COALESCE(c.model, b.model) AS model,
               COALESCE(c.images, b.images) AS images,
               COALESCE(c.car_type, b.car_type) AS car_type,
               u.name AS user_name,
               u.email AS user_email,
               u.phone AS user_phone,
               u.photo AS user_photo,
               ag.agency_name,
               pi.pickup_id,
               pi.pickup_time,
               pi.fuel_level AS pickup_fuel_level,
               pi.odometer_reading AS pickup_odometer,
               pi.early_fee AS pickup_early_fee,
               pi.fuel_charge AS pickup_fuel_charge,
               pi.pickup_notes,
               pi.confirmed AS pickup_confirmed
          FROM booking_info bi
          JOIN users u ON bi.user_id = u.user_id
          JOIN agencies ag ON ag.agency_id = $1
          LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car' AND c.agency_id = $1
          LEFT JOIN bikes b ON bi.vehicle_id = b.bike_id AND LOWER(bi.vehicle_type::text) = 'bike' AND b.agency_id = $1
          LEFT JOIN pickup_info pi ON bi.booking_id = pi.booking_id
          WHERE (c.agency_id = $1 OR b.agency_id = $1)
          ORDER BY bi.booking_ts DESC
     `
     try {
          const result = await pool.query(query, [agencyId.trim()]);
          res.json(result.rows);
     } catch (error) {
          console.error('Error in getAgencyBookingsByAgencyId:', error);
          res.status(500).json({ error: 'Internal server error' });
     }
}

const updateAgencyOwnerInfo = asyncHandler(async (req, res) => {
     // Validate and sanitize the owner ID from params
     const ownerId = agencyValidator.validateOwnerId(req.params.id);

     // Validate and sanitize only provided fields in the request body
     const validatedData = agencyValidator.validateUpdateOwnerInfo(req.body);

     // Call the service to update owner info (partial update)
     const updatedOwner = await agencyService.updateAgencyOwnerInfo(ownerId, validatedData);

     // Send success response
     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: MESSAGES.AGENCY_OWNER_UPDATED,
          data: updatedOwner
     });
});


const updateAgencyInfo = asyncHandler(async (req, res) => {
     // Validate and sanitize the agency ID from params
     const agencyId = agencyValidator.validateAgencyId(req.params.id);

     // Validate and sanitize only provided fields in the request body
     const validatedData = agencyValidator.validateUpdateAgency(req.body);

     // Call the service to update agency info (partial update)
     const updatedAgency = await agencyService.updateAgencyInfo(agencyId, validatedData);

     // Send success response
     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: MESSAGES.AGENCY_UPDATED,
          data: updatedAgency
     });
});

const getAgencyByIdDetailed = async (req, res) => {
     const agencyId = req.params.id;
     const query = `
          SELECT 
               ag.*, 
               u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.photo as owner_photo,
               ada.city as agency_city, ada.area as agency_area, ada.postcode as agency_postcode, ada.display_name as agency_full_address,
               (SELECT COUNT(*) FROM cars WHERE agency_id = ag.agency_id) as car_count,
               (SELECT COUNT(*) FROM bikes WHERE agency_id = ag.agency_id) as bike_count
          FROM agencies as ag
          JOIN users as u ON ag.owner_id = u.user_id
          JOIN address as ada ON ag.address_id = ada.address_id
          WHERE ag.agency_id = $1
     `
     try {
          const result = await pool.query(query, [agencyId]);
          if (result.rowCount === 0) {
               return res.status(404).json({ message: 'Agency not found.' });
          }
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAdminStats = async (req, res) => {
     const query = `
          SELECT 
               (SELECT COUNT(*) FROM users) as total_users,
               (SELECT COUNT(*) FROM agencies) as total_agencies,
               (SELECT COUNT(*) FROM driver_info) as total_drivers,
               (SELECT COUNT(*) FROM cars) + (SELECT COUNT(*) FROM bikes) as total_vehicles,
               (SELECT COUNT(*) FROM booking_info) as total_bookings,
               (SELECT SUM(total_cost) FROM booking_info WHERE status = 'Completed') as total_revenue
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getFilteredAgencies = async (req, res) => {
    const { search, status, verified, city, page = 0, limit = 8 } = req.query;
    const offset = page * limit;

    let query = `
        SELECT ag.*, u.name as owner_name, ad.city, ad.display_name as full_address
        FROM agencies ag
        JOIN users u ON ag.owner_id = u.user_id
        JOIN address ad ON ag.address_id = ad.address_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        params.push(`%${search}%`);
        query += ` AND (ag.agency_name ILIKE $${params.length} OR ag.email ILIKE $${params.length} OR ag.phone_number ILIKE $${params.length})`;
    }

    if (status && status !== 'All') {
        params.push(status); // Status is typically capitalized in DB based on enum
        query += ` AND ag.status::text = $${params.length}`;
    }

    if (verified && verified !== 'All') {
        params.push(verified === 'Yes');
        query += ` AND ag.verified = $${params.length}`;
    }

    if (city && city !== 'All') {
        params.push(city);
        query += ` AND ad.city = $${params.length}`;
    }

    try {
        // Total count
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered`;
        const countRes = await pool.query(countQuery, params);
        const totalCount = parseInt(countRes.rows[0].count);

        // Data with ordering and pagination
        query += ` ORDER BY ag.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const result = await pool.query(query, [...params, limit, offset]);

        res.json({
            agencies: result.rows,
            totalCount
        });
    } catch (err) {
        console.error("Error in getFilteredAgencies:", err);
        res.status(500).send(err.message);
    }
};

const getAgencyAdminDetails = async (req, res) => {
    const { agencyId } = req.params;
    try {
        // 1. Basic Info & Documents & Owner Info
        const infoQuery = `
            SELECT ag.*, ad.city, ad.area, ad.display_name as full_address,
                   u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.nid as owner_nid
            FROM agencies ag
            JOIN address ad ON ag.address_id = ad.address_id
            JOIN users u ON ag.owner_id = u.user_id
            WHERE ag.agency_id = $1
        `;
        const infoRes = await pool.query(infoQuery, [agencyId]);
        if (infoRes.rowCount === 0) return res.status(404).json({ message: 'Agency not found' });

        // 2. Fleet Info
        const carsQuery = `SELECT car_id as id, brand, model, status, 'car' as type FROM cars WHERE agency_id = $1`;
        const bikesQuery = `SELECT bike_id as id, brand, model, status, 'bike' as type FROM bikes WHERE agency_id = $1`;
        const carsRes = await pool.query(carsQuery, [agencyId]);
        const bikesRes = await pool.query(bikesQuery, [agencyId]);

        // 3. Reviews
        const reviewsQuery = `
            SELECT ar.*, u.name as user_name
            FROM agency_reviews ar
            JOIN users u ON ar.user_id = u.user_id
            WHERE ar.agency_id = $1
            ORDER BY ar.date DESC
        `;
        const reviewsRes = await pool.query(reviewsQuery, [agencyId]);

        res.json({
            overview: infoRes.rows[0],
            fleet: [...carsRes.rows, ...bikesRes.rows],
            reviews: reviewsRes.rows
        });
    } catch (err) {
        console.error("Error in getAgencyAdminDetails:", err);
        res.status(500).send(err.message);
    }
};

const updateAgencyAdminStatus = async (req, res) => {
    const { agencyId } = req.params;
    const { status, verified, expire_date, admin_note } = req.body;

    try {
        const query = `
            UPDATE agencies
            SET status = $1, verified = $2, expire_date = $3
            WHERE agency_id = $4
            RETURNING *
        `;
        const result = await pool.query(query, [status, verified, expire_date || null, agencyId]);
        
        if (result.rowCount === 0) return res.status(404).json({ message: 'Agency not found' });
        
        // If status is Active and verified is true, we might want to update user role to 'agency' if not already
        if (status === 'Active' && verified === true) {
            await pool.query(`UPDATE users SET userrole = 'agency' WHERE user_id = $1`, [result.rows[0].owner_id]);
        }

        res.json({ message: 'Agency updated successfully', agency: result.rows[0] });
    } catch (err) {
        console.error("Error in updateAgencyAdminStatus:", err);
        res.status(500).send(err.message);
    }
};

const getAgencyCities = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT ad.city 
            FROM address ad
            JOIN agencies ag ON ad.address_id = ag.address_id
            WHERE ad.city IS NOT NULL
            ORDER BY ad.city
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.city));
    } catch (err) {
        res.status(500).send(err.message);
    }
};

module.exports = { 
     getAllAgency, 
     getAgencyDetails, 
     getAgencyOwner, 
     getAllBookings,
     getAgencyProfile, 
     getAgencyCarsByOwner, 
     getAgencyActiveBookingCars,
     getAgencyBookings,
     getAgencyBookingsByEmail,
     getAgencyBookingsByAgencyId,
     updateAgencyOwnerInfo,
     updateAgencyInfo,
     getAgencyByIdDetailed,
     getAdminStats,
     getFilteredAgencies,
     getAgencyAdminDetails,
     updateAgencyAdminStatus,
     getAgencyCities
};