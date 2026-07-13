import mongoose from 'mongoose';
import DistributorLead from '../models/DistributorLead.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ALLOWED_CALL_STATUSES = ['not_required', 'pending_call', 'called', 'converted'];

// GET /api/v1/admin/distributor/leads?status=&leadCallStatus=&search=&page=&limit=
export const listLeads = asyncHandler(async (req, res) => {
  const { status, leadCallStatus, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (leadCallStatus) filter.leadCallStatus = leadCallStatus;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') },
      { pincode: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [leads, total] = await Promise.all([
    DistributorLead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    DistributorLead.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: leads,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

// GET /api/v1/admin/distributor/leads/:id
export const getLead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid lead id');
    error.statusCode = 400;
    throw error;
  }

  const lead = await DistributorLead.findById(id);
  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json({ success: true, data: lead });
});

// PATCH /api/v1/admin/distributor/leads/:id/call-status
// Deliberately narrow — only leadCallStatus can be changed here, never
// payment fields or the booking status itself, so this endpoint can't
// accidentally be used to fake a payment confirmation.
export const updateLeadCallStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { leadCallStatus } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid lead id');
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_CALL_STATUSES.includes(leadCallStatus)) {
    const error = new Error(`leadCallStatus must be one of: ${ALLOWED_CALL_STATUSES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const lead = await DistributorLead.findOneAndUpdate(
    { _id: id },
    { $set: { leadCallStatus } },
    { returnDocument: 'after' }
  );

  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json({ success: true, data: lead });
});