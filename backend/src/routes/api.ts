import { Router } from 'express';
import { getStudents, getStudentById } from '../controllers/studentController';
import { getDeficiencyRecords, simulateAttendance } from '../controllers/deficiencyController';
import { dispatchBatchAlerts, getDeliveryHealth } from '../controllers/notificationController';
import { handleWhatsAppWebhook } from '../controllers/whatsappController';
import { submitLeaveOD, approveLeaveOD } from '../controllers/leaveODController';
import { createCounselingLog, getCounselingLogs } from '../controllers/counselingController';
import { getAuditLogs } from '../controllers/auditController';
import { generatePDFNotice } from '../controllers/pdfController';
import { registerUser, verifyAuthenticatorRegistration, loginUser, verifyLoginAuthenticator, updateProfile, beginAdminAuthenticatorSetup, verifyAdminAuthenticatorSetup } from '../controllers/authController';
import { bulkUploadExcel } from '../controllers/uploadController';

const router = Router();

// Auth & Profile & 2FA Routes
router.post('/auth/register', registerUser);
router.post('/auth/register/verify-authenticator', verifyAuthenticatorRegistration);
router.post('/auth/login', loginUser);
router.put('/auth/profile', updateProfile);
router.post('/auth/login/verify-authenticator', verifyLoginAuthenticator);
router.post('/auth/admin/setup-authenticator', beginAdminAuthenticatorSetup);
router.post('/auth/admin/verify-authenticator', verifyAdminAuthenticatorSetup);

// Bulk Excel / CSV Upload Route
router.post('/upload/bulk-excel', bulkUploadExcel);

// Student Routes
router.get('/students', getStudents);
router.get('/students/:id', getStudentById);

// Deficiency & Predictive Simulator Routes
router.get('/deficiency-records', getDeficiencyRecords);
router.post('/deficiency/simulate', simulateAttendance);

// Multi-Channel Notifications & Health
router.post('/notifications/dispatch-batch', dispatchBatchAlerts);
router.get('/notifications/health', getDeliveryHealth);

// 2-Way Parent Gateway (WhatsApp Webhook)
router.post('/whatsapp/webhook', handleWhatsAppWebhook);

// Leave & OD Compensation Module
router.post('/leave-od', submitLeaveOD);
router.post('/leave-od/:id/approve', approveLeaveOD);

// Mentor Counseling Module
router.post('/counseling', createCounselingLog);
router.get('/counseling', getCounselingLogs);

// Compliance & Audit Logs
router.get('/audit-logs', getAuditLogs);

// Verification & PDF Generation
router.get('/pdf/deficiency-notice', generatePDFNotice);

export default router;
