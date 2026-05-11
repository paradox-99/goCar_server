const express = require('express');
const Router = express.Router();
const { verifyToken, verifyAgency } = require('../config/jwt');
const {
    getAgencyDamageStats,
    getAgencyDamageList,
    getAgencyDamageDetail,
    updateAgencyDamageReport,
    bulkUpdateDamageStatus,
    recordDamageCharge,
    getRepeatOffenderVehicles,
    getAgencyDamageFilterOptions
} = require('../controllers/agencyDamageController');

Router.get('/stats/:agencyId', verifyToken, verifyAgency, getAgencyDamageStats);
Router.get('/list/:agencyId', verifyToken, verifyAgency, getAgencyDamageList);
Router.get('/detail/:damageId', verifyToken, verifyAgency, getAgencyDamageDetail);
Router.patch('/update/:damageId', verifyToken, verifyAgency, updateAgencyDamageReport);
Router.patch('/bulk-update', verifyToken, verifyAgency, bulkUpdateDamageStatus);
Router.post('/charge/:damageId', verifyToken, verifyAgency, recordDamageCharge);
Router.get('/repeat-vehicles/:agencyId', verifyToken, verifyAgency, getRepeatOffenderVehicles);
Router.get('/filter-options/:agencyId', verifyToken, verifyAgency, getAgencyDamageFilterOptions);

module.exports = Router;
