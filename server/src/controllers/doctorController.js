import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../services/auditService.js';
import * as doctors from '../services/doctorService.js';
import * as specs from '../services/specializationService.js';
import { getAvailableSlots } from '../services/slotService.js';

export const listSpecializations = asyncHandler(async (_req, res) => res.json({ items: await specs.listSpecializations() }));
export const createSpecialization = asyncHandler(async (req, res) => {
  const item = await specs.createSpecialization(req.body);
  await audit(req, { action: 'SPECIALIZATION_CREATED', entityType: 'Specialization', entityId: item.id, details: { name: item.name } });
  res.status(201).json({ item });
});
export const updateSpecialization = asyncHandler(async (req, res) => {
  const item = await specs.updateSpecialization(req.params.id, req.body);
  await audit(req, { action: 'SPECIALIZATION_UPDATED', entityType: 'Specialization', entityId: item.id, details: { name: item.name } });
  res.json({ item });
});
export const deleteSpecialization = asyncHandler(async (req, res) => {
  await specs.deleteSpecialization(req.params.id);
  await audit(req, { action: 'SPECIALIZATION_DELETED', entityType: 'Specialization', entityId: req.params.id });
  res.json({ message: 'Deleted' });
});

const isAdmin = (req) => req.user?.role === 'ADMIN';

export const listDoctors = asyncHandler(async (req, res) => {
  res.json(await doctors.listDoctors(req.query, { adminView: isAdmin(req) && req.query.status !== undefined }));
});
export const adminListDoctors = asyncHandler(async (req, res) => res.json(await doctors.listDoctors(req.query, { adminView: true })));
export const getDoctor = asyncHandler(async (req, res) => res.json({ doctor: await doctors.getDoctor(req.params.id, { adminView: isAdmin(req) }) }));
export const slots = asyncHandler(async (req, res) => res.json(await getAvailableSlots(req.params.id, req.query.date)));

export const createDoctor = asyncHandler(async (req, res) => {
  const created = await doctors.createDoctor(req.body, req);
  await audit(req, { action: 'DOCTOR_CREATED', entityType: 'DoctorProfile', entityId: created.doctorId });
  res.status(201).json({ doctor: await doctors.getDoctor(created.doctorId, { adminView: true }) });
});
export const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctors.updateDoctor(req.params.id, req.body);
  await audit(req, { action: 'DOCTOR_UPDATED', entityType: 'DoctorProfile', entityId: req.params.id, details: { fields: Object.keys(req.body) } });
  res.json({ doctor });
});
export const setStatus = asyncHandler(async (req, res) => {
  const result = await doctors.setDoctorActive(req.params.id, req.body.isActive);
  await audit(req, { action: req.body.isActive ? 'DOCTOR_ACTIVATED' : 'DOCTOR_DEACTIVATED', entityType: 'DoctorProfile', entityId: req.params.id });
  res.json(result);
});

export const getSchedule = asyncHandler(async (req, res) => res.json(await doctors.getSchedule(req.params.id)));
export const putSchedule = asyncHandler(async (req, res) => {
  await doctors.assertCanManageDoctor(req.user, req.params.id);
  const result = await doctors.replaceSchedule(req.params.id, req.body.sessions);
  await audit(req, { action: 'DOCTOR_SCHEDULE_UPDATED', entityType: 'DoctorProfile', entityId: req.params.id, details: { sessions: req.body.sessions.length } });
  res.json(result);
});
export const addLeave = asyncHandler(async (req, res) => {
  await doctors.assertCanManageDoctor(req.user, req.params.id);
  const leave = await doctors.addLeave(req.user, req.params.id, req.body);
  await audit(req, { action: 'DOCTOR_LEAVE_ADDED', entityType: 'DoctorProfile', entityId: req.params.id, details: { startDate: leave.startDate, endDate: leave.endDate, cancelled: leave.cancelledAppointments } });
  res.status(201).json({ leave });
});
export const removeLeave = asyncHandler(async (req, res) => {
  await doctors.assertCanManageDoctor(req.user, req.params.id);
  await doctors.removeLeave(req.params.id, req.params.leaveId);
  res.json({ message: 'Leave removed' });
});
