// Tiny holder so services can emit events without importing the HTTP server.
let io = null;

export const setIO = (instance) => {
  io = instance;
};

export const emitToUser = (userId, event, payload = {}) => {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
};

// Payloads contain only ids and timestamps - clients refetch what they are allowed to see.
export const emitQueueUpdated = (doctorId) => {
  if (io && doctorId) io.to(`doctor:${doctorId}`).emit('queue:updated', { doctorId, at: Date.now() });
};
