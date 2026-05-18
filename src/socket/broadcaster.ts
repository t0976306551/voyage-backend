import type { Server as SocketIOServer } from 'socket.io';
import { getSocketIdsByUserId } from './socket.registry';

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

/**
 * Force all sockets belonging to userId to leave the trip room and notify them.
 * Called after a member is kicked or leaves so they stop receiving room broadcasts.
 */
export function forceLeaveTrip(userId: string, tripId: string): void {
  if (!io) return;
  const socketIds = getSocketIdsByUserId(userId);
  const room = `trip:${tripId}`;
  for (const socketId of socketIds) {
    io.in(socketId).socketsLeave(room);
    io.to(socketId).emit('trip:kicked', { tripId });
  }
}
