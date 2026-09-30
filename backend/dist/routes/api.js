"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentController_1 = require("../controllers/studentController");
const deficiencyController_1 = require("../controllers/deficiencyController");
const notificationController_1 = require("../controllers/notificationController");
const whatsappController_1 = require("../controllers/whatsappController");
const leaveODController_1 = require("../controllers/leaveODController");
const counselingController_1 = require("../controllers/counselingController");
const auditController_1 = require("../controllers/auditController");
const pdfController_1 = require("../controllers/pdfController");
const authController_1 = require("../controllers/authController");
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
// Auth & Profile & 2FA Routes
router.post('/auth/register', authController_1.registerUser);
router.post('/auth/login', authController_1.loginUser);
router.put('/auth/profile', authController_1.updateProfile);
router.post('/auth/send-admin-otp', authController_1.sendAdminOTP);
router.post('/auth/verify-admin-otp', authController_1.verifyAdminOTP);
// Bulk Excel / CSV Upload Route
router.post('/upload/bulk-excel', uploadController_1.bulkUploadExcel);
// Student Routes
router.get('/students', studentController_1.getStudents);
router.get('/students/:id', studentController_1.getStudentById);
// Deficiency & Predictive Simulator Routes
router.get('/deficiency-records', deficiencyController_1.getDeficiencyRecords);
router.post('/deficiency/simulate', deficiencyController_1.simulateAttendance);
// Multi-Channel Notifications & Health
router.post('/notifications/dispatch-batch', notificationController_1.dispatchBatchAlerts);
router.get('/notifications/health', notificationController_1.getDeliveryHealth);
// 2-Way Parent Gateway (WhatsApp Webhook)
router.post('/whatsapp/webhook', whatsappController_1.handleWhatsAppWebhook);
// Leave & OD Compensation Module
router.post('/leave-od', leaveODController_1.submitLeaveOD);
router.post('/leave-od/:id/approve', leaveODController_1.approveLeaveOD);
// Mentor Counseling Module
router.post('/counseling', counselingController_1.createCounselingLog);
router.get('/counseling', counselingController_1.getCounselingLogs);
// Compliance & Audit Logs
router.get('/audit-logs', auditController_1.getAuditLogs);
// Verification & PDF Generation
router.get('/pdf/deficiency-notice', pdfController_1.generatePDFNotice);
exports.default = router;
