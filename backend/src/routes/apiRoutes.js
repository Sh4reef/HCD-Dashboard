const express = require('express');
const router = express.Router();
const hcdController = require('../controllers/hcdController');

// 1. Auth & Google OAuth Domain Restriction
router.post('/auth/google/callback', hcdController.handleGoogleOAuthCallback);

// 2. Module 1: Internship Operations
router.get('/internships', hcdController.getInternships);
router.post('/internships/:id/issue-certificate', hcdController.issueInternshipCertificate);

// 3. Module 2: License & Certification Validation
router.get('/licenses', hcdController.getLicenses);
router.post('/licenses/:id/renew', hcdController.renewLicense);

// 4. Module 3: Employee Training Programs & Deficit Queue
router.get('/training/under-trained-queue', hcdController.getUnderTrainedQueue);
router.patch('/training/participants/:participantId/status', hcdController.updateParticipantStatus);

// 5. Module 4: Strategic KPI Monitoring
router.get('/kpis', hcdController.getKpis);

// 6. Module 5: Halo HC Service Desk & SLA Monitoring
router.get('/halo-hc/tickets', hcdController.getHaloHcTickets);

// 7. Module 6: Executive Analytics Dashboard
router.get('/analytics/executive-dashboard', hcdController.getExecutiveAnalytics);

// 8. Google Sheets Synchronization Trigger
router.post('/sync/sheets/trigger', hcdController.triggerSheetSync);

module.exports = router;
