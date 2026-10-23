import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { TOKEN_COOKIE } from '../middleware/auth.js';
import { setIO } from './io.js';

/*
 * Real-time updates with Socket.IO.
 *  - The login cookie authenticates the socket (same token as the REST API).
 *  - Every user joins a private room "user:<id>" (their own notifications / status changes).
 *  - Staff can watch a doctor's queue by joining "doctor:<doctorProfileId>".
 *  - Events carry only ids and timestamps; clients re-fetch the data they are allowed to see.
 */
export function attachSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.clientUrl, credentials: true } });

  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies[TOKEN_COOKIE];
      if (!token) return next(new Error('unauthenticated'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true, doctorProfile: { select: { id: true } } } });
      if (!user?.isActive) return next(new Error('unauthenticated'));
      socket.data.user = user;
      return next();
    } catch {
      return next(new Error('unauthenticated'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (user.doctorProfile) socket.join(`doctor:${user.doctorProfile.id}`);

    // Ask to receive queue updates for one doctor. Permission is checked here, server-side.
    socket.on('queue:subscribe', async (doctorId, ack) => {
      try {
        if (typeof doctorId !== 'string' || doctorId.length > 64) throw new Error('bad id');
        let allowed = false;
        if (user.role === 'RECEPTIONIST' || user.role === 'ADMIN') allowed = true;
        else if (user.role === 'DOCTOR') allowed = user.doctorProfile?.id === doctorId;
        else if (user.role === 'PATIENT') {
          allowed = !!(await prisma.appointment.findFirst({ where: { doctorId, patient: { userId: user.id } }, select: { id: true } }));
        }
        if (allowed) socket.join(`doctor:${doctorId}`);
        ack?.({ ok: allowed });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on('queue:unsubscribe', (doctorId) => {
      if (typeof doctorId === 'string' && doctorId !== user.doctorProfile?.id) socket.leave(`doctor:${doctorId}`);
    });
  });

  setIO(io);
  return io;
}
