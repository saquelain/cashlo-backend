import express from 'express';
import {
  listLeads,
  getLead,
  updateLeadCallStatus,
  listWebhookLogs,
  markLeadPaidManually,
  cancelManualLead,
} from '../controllers/distributorAdmin.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin', 'sales'));

router.get('/leads', listLeads);
router.get('/leads/:id', getLead);
router.patch('/leads/:id/call-status', updateLeadCallStatus);
router.patch('/leads/:id/mark-paid', markLeadPaidManually);
router.patch('/leads/:id/cancel', cancelManualLead);
router.get('/webhook-logs', listWebhookLogs);

export default router;