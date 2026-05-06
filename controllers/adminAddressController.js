const pool = require('../config/db');

// Get stats for address management
const getAdminAddressStats = async (req, res) => {
    try {
        const statsQuery = `
            WITH LinkedStatus AS (
                SELECT a.address_id,
                       CASE WHEN u.user_id IS NOT NULL THEN 1 ELSE 0 END as has_user,
                       CASE WHEN ag.agency_id IS NOT NULL THEN 1 ELSE 0 END as has_agency,
                       CASE WHEN d.driver_id IS NOT NULL THEN 1 ELSE 0 END as has_driver
                FROM address a
                LEFT JOIN users u ON a.address_id = u.address_id
                LEFT JOIN agencies ag ON a.address_id = ag.address_id
                LEFT JOIN driver_info d ON a.address_id = d.address_id
            )
            SELECT 
                (SELECT COUNT(*) FROM address) as total_addresses,
                SUM(has_user) as user_addresses,
                SUM(has_agency) as agency_addresses,
                SUM(has_driver) as driver_addresses,
                SUM(CASE WHEN has_user = 0 AND has_agency = 0 AND has_driver = 0 THEN 1 ELSE 0 END) as orphaned_addresses,
                (SELECT COUNT(DISTINCT city) FROM address WHERE city IS NOT NULL) as unique_cities
            FROM LinkedStatus;
        `;
        const result = await pool.query(statsQuery);
        res.json({
            totalAddresses: parseInt(result.rows[0].total_addresses),
            userAddresses: parseInt(result.rows[0].user_addresses),
            agencyAddresses: parseInt(result.rows[0].agency_addresses),
            driverAddresses: parseInt(result.rows[0].driver_addresses),
            orphanedAddresses: parseInt(result.rows[0].orphaned_addresses),
            uniqueCities: parseInt(result.rows[0].unique_cities)
        });
    } catch (error) {
        console.error('Error fetching admin address stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get paginated and filtered list of addresses
const getAdminAddressList = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = '',
        city = 'All',
        linkedTo = 'All',
        hasGeom = 'All',
        hasPlaceId = 'All',
        quickFilter = 'All'
    } = req.query;

    const offset = (page - 1) * limit;
    let values = [];
    let whereClauses = [];

    // JSON aggregation is used to fetch multiple linked entities compactly
    let query = `
        SELECT a.address_id, a.display_name, a.city, a.area, a.postcode, 
               a.latitude, a.longitude, a.place_id, 
               CASE WHEN a.geom IS NOT NULL THEN true ELSE false END as has_geom,
               (
                   SELECT json_agg(json_build_object('id', u.user_id, 'name', u.name, 'email', u.email, 'photo', u.photo, 'role', u.userrole, 'status', u.accountstatus))
                   FROM users u WHERE u.address_id = a.address_id
               ) as linked_users,
               (
                   SELECT json_agg(json_build_object('id', ag.agency_id, 'name', ag.agency_name, 'phone', ag.phone_number, 'email', ag.email, 'status', ag.status, 'verified', ag.verified))
                   FROM agencies ag WHERE ag.address_id = a.address_id
               ) as linked_agencies,
               (
                   SELECT json_agg(json_build_object('id', d.driver_id, 'name', d.name, 'phone', d.phone, 'photo', d.photo, 'license_status', d.license_status, 'availability', d.availability))
                   FROM driver_info d WHERE d.address_id = a.address_id
               ) as linked_drivers
        FROM address a
    `;

    // To properly filter by linked status efficiently without crazy subqueries in WHERE, we can use EXISTS
    
    if (search) {
        whereClauses.push(`(a.city ILIKE $${values.length + 1} OR a.area ILIKE $${values.length + 1} OR a.postcode ILIKE $${values.length + 1} OR a.display_name ILIKE $${values.length + 1} OR a.place_id ILIKE $${values.length + 1})`);
        values.push(`%${search}%`);
    }

    if (city && city !== 'All') {
        whereClauses.push(`a.city = $${values.length + 1}`);
        values.push(city);
    }

    if (hasGeom === 'Has Geom') whereClauses.push('a.geom IS NOT NULL');
    if (hasGeom === 'Missing Geom') whereClauses.push('a.geom IS NULL');
    if (quickFilter === 'Missing Geom') whereClauses.push('a.geom IS NULL');

    if (hasPlaceId === 'Has Place ID') whereClauses.push('a.place_id IS NOT NULL');
    if (hasPlaceId === 'Missing Place ID') whereClauses.push('a.place_id IS NULL');
    if (quickFilter === 'Missing Place ID') whereClauses.push('a.place_id IS NULL');

    const checkLinked = (type) => {
        if (type === 'User') return 'EXISTS (SELECT 1 FROM users WHERE address_id = a.address_id)';
        if (type === 'Agency') return 'EXISTS (SELECT 1 FROM agencies WHERE address_id = a.address_id)';
        if (type === 'Driver') return 'EXISTS (SELECT 1 FROM driver_info WHERE address_id = a.address_id)';
        if (type === 'Orphaned') return 'NOT EXISTS (SELECT 1 FROM users WHERE address_id = a.address_id) AND NOT EXISTS (SELECT 1 FROM agencies WHERE address_id = a.address_id) AND NOT EXISTS (SELECT 1 FROM driver_info WHERE address_id = a.address_id)';
        return null;
    };

    let linkedCondition = null;
    if (linkedTo !== 'All') linkedCondition = checkLinked(linkedTo);
    if (quickFilter === 'User Addresses') linkedCondition = checkLinked('User');
    if (quickFilter === 'Agency Addresses') linkedCondition = checkLinked('Agency');
    if (quickFilter === 'Driver Addresses') linkedCondition = checkLinked('Driver');
    if (quickFilter === 'Orphaned') linkedCondition = checkLinked('Orphaned');

    if (linkedCondition) {
        whereClauses.push(linkedCondition);
    }
    
    // Check if quickFilter is a city name (assuming it's not one of the predefined ones)
    const predefinedFilters = ['All Addresses', 'User Addresses', 'Agency Addresses', 'Driver Addresses', 'Orphaned', 'Missing Geom', 'Missing Place ID'];
    if (quickFilter && quickFilter !== 'All' && !predefinedFilters.includes(quickFilter)) {
        whereClauses.push(`a.city = $${values.length + 1}`);
        values.push(quickFilter);
    }

    let countQuery = 'SELECT COUNT(*) FROM address a';
    
    if (whereClauses.length > 0) {
        const whereString = ' WHERE ' + whereClauses.join(' AND ');
        query += whereString;
        countQuery += whereString;
    }

    query += ` ORDER BY a.city, a.address_id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const finalValues = [...values, limit, offset];

    try {
        const listResult = await pool.query(query, finalValues);
        const countResult = await pool.query(countQuery, values);

        res.json({
            addresses: listResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching admin addresses list:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get map data (fetch all coordinates for map visualization)
const getAdminAddressMapData = async (req, res) => {
    try {
        // We need to fetch all pins. If there are too many (e.g., > 10,000), 
        // we might need to limit or cluster on the backend, but for typical use case, 
        // frontend clustering with Leaflet is fine. Let's send the essential data.
        const query = `
            SELECT a.address_id, a.latitude, a.longitude, a.display_name, a.city, a.area,
                   EXISTS (SELECT 1 FROM users WHERE address_id = a.address_id) as has_user,
                   EXISTS (SELECT 1 FROM agencies WHERE address_id = a.address_id) as has_agency,
                   EXISTS (SELECT 1 FROM driver_info WHERE address_id = a.address_id) as has_driver
            FROM address a
            WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
        `;
        const result = await pool.query(query);
        
        const pins = result.rows.map(row => {
            let type = 'orphaned';
            let types = [];
            if (row.has_user) types.push('user');
            if (row.has_agency) types.push('agency');
            if (row.has_driver) types.push('driver');
            
            if (types.length > 1) type = 'multiple';
            else if (types.length === 1) type = types[0];
            
            return {
                id: row.address_id,
                lat: parseFloat(row.latitude),
                lng: parseFloat(row.longitude),
                name: row.display_name,
                city: row.city,
                area: row.area,
                type: type,
                types: types // Send array of types for popup details
            };
        });

        res.json(pins);
    } catch (error) {
        console.error('Error fetching admin map data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete address(es)
const deleteAdminAddresses = async (req, res) => {
    const { addressIds } = req.body;

    if (!addressIds || !Array.isArray(addressIds) || addressIds.length === 0) {
        return res.status(400).json({ message: 'No address IDs provided' });
    }

    try {
        // First check if any of these addresses are still linked
        // In theory frontend disables delete if linked, but we must protect the backend
        const checkQuery = `
            SELECT address_id FROM address a
            WHERE address_id = ANY($1)
              AND (
                  EXISTS (SELECT 1 FROM users WHERE address_id = a.address_id) OR
                  EXISTS (SELECT 1 FROM agencies WHERE address_id = a.address_id) OR
                  EXISTS (SELECT 1 FROM driver_info WHERE address_id = a.address_id)
              )
        `;
        const checkResult = await pool.query(checkQuery, [addressIds]);
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ 
                message: `Cannot delete. ${checkResult.rows.length} addresses are still linked to entities.`,
                linkedAddressIds: checkResult.rows.map(r => r.address_id)
            });
        }

        await pool.query(
            `DELETE FROM address WHERE address_id = ANY($1)`,
            [addressIds]
        );
        res.json({ message: 'Addresses deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin addresses:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get distinct cities
const getDistinctCities = async (req, res) => {
    try {
        const result = await pool.query(`SELECT DISTINCT city FROM address WHERE city IS NOT NULL ORDER BY city ASC`);
        res.json(result.rows.map(r => r.city));
    } catch (error) {
        console.error('Error fetching distinct cities:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getAdminAddressStats,
    getAdminAddressList,
    getAdminAddressMapData,
    deleteAdminAddresses,
    getDistinctCities
};
