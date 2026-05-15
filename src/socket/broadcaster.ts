import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setIO(server: SocketIOServer): void {
  io = server;
}

/**
 * Server-initiated broadcast to all clients in a trip room (except no exclusion).
 * Safe to call before io is initialized — silently no-ops in tests.
 */
export function broadcastToTrip(tripId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`trip:${tripId}`).emit(event, data);
}
