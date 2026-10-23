import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import * as appts from '../services/appointmentService.js';
import * as queue from '../services/queueService.js';

export const book = asyncHandler(async (req, res) => {
  res.status(201).json({ appointment: await appts.bookAppointment({ actor: req.user, ...req.body }) });
});
export const list = asyncHandler(async (req, res) => res.json(await appts.listAppointments({ actor: req.user, query: req.query })));
export const get = asyncHandler(async (req, res) => res.json({ appointment: await appts.getAppointment(req.params.id, req.user) }));
export const cancel = asyncHandler(async (req, res) => {
  res.json({ appointment: await appts.cancelAppointment({ actor: req.user, id: req.params.id, reason: req.body.reason, req }) });
});
export const reschedule = asyncHandler(async (req, res) => {
  res.json({ appointment: await appts.rescheduleAppointment({ actor: req.user, id: req.params.id, startsAt: req.body.startsAt }) });
});

// Doctor-driven status changes. Each transition is validated by the service it calls.
export const changeStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const { id } = req.params;
  if (status === 'CONFIRMED') return res.json({ appointment: await appts.confirmAppointment({ actor: req.user, id }) });
  if (status === 'CANCELLED') return res.json({ appointment: await appts.cancelAppointment({ actor: req.user, id, reason, req }) });
  await appts.loadForActor(id, req.user); // ownership check
  const entryId = await queue.entryIdForAppointment(id);
  if (status === 'IN_CONSULTATION') await queue.startConsultation({ actor: req.user, entryId });
  else if (status === 'COMPLETED') await queue.completeConsultation({ actor: req.user, entryId });
  else throw new AppError(400, 'INVALID_STATUS', 'Unsupported status change.');
  return res.json({ appointment: await appts.getAppointment(id, req.user) });
});
