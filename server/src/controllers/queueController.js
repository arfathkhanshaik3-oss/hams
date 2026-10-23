import { asyncHandler } from '../utils/asyncHandler.js';
import * as queue from '../services/queueService.js';
import * as patients from '../services/patientService.js';

export const doctorQueue = asyncHandler(async (req, res) =>
  res.json(await queue.getDoctorQueue({ actor: req.user, doctorId: req.params.doctorId, date: req.query.date })));
export const overview = asyncHandler(async (req, res) => res.json(await queue.getOverview({ date: req.query.date })));
export const myStatus = asyncHandler(async (req, res) =>
  res.json(await queue.getMyQueueStatus({ actor: req.user, appointmentId: req.params.appointmentId })));
export const checkIn = asyncHandler(async (req, res) =>
  res.json(await queue.checkIn({ actor: req.user, appointmentId: req.params.appointmentId, req })));
export const walkIn = asyncHandler(async (req, res) =>
  res.status(201).json({ appointment: await queue.registerWalkIn({ actor: req.user, req, ...req.body }) }));
export const callNext = asyncHandler(async (req, res) =>
  res.json(await queue.callNext({ actor: req.user, doctorId: req.params.doctorId, req })));
export const start = asyncHandler(async (req, res) => res.json(await queue.startConsultation({ actor: req.user, entryId: req.params.entryId })));
export const complete = asyncHandler(async (req, res) => res.json(await queue.completeConsultation({ actor: req.user, entryId: req.params.entryId })));
export const skip = asyncHandler(async (req, res) =>
  res.json(await queue.skipPatient({ actor: req.user, entryId: req.params.entryId, reason: req.body.reason, req })));
export const noShow = asyncHandler(async (req, res) =>
  res.json(await queue.markNoShow({ actor: req.user, entryId: req.params.entryId, reason: req.body.reason, req })));
export const reorder = asyncHandler(async (req, res) =>
  res.json(await queue.reorderEntry({ actor: req.user, entryId: req.params.entryId, ...req.body, req })));
export const seat = asyncHandler(async (req, res) => res.json(await queue.seatInWaitingArea({ actor: req.user, entryId: req.params.entryId })));

export const searchPatients = asyncHandler(async (req, res) => res.json(await patients.searchPatients(req.query)));
export const createPatient = asyncHandler(async (req, res) => res.status(201).json({ patient: await patients.createWalkInPatient(req.body, req) }));
