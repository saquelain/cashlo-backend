import express from 'express';
import { listLeads, getLead, updateLeadCallStatus } from '../controllers/distributorAdmin.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import { listWebhookLogs } from '../controllers/distributorAdmin.controller.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin', 'sales'));

router.get('/leads', listLeads);
router.get('/leads/:id', getLead);
router.patch('/leads/:id/call-status', updateLeadCallStatus);
router.get('/webhook-logs', listWebhookLogs);

export default router;