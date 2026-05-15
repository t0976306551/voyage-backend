import { Server as SocketIOServer, Socket } from 'socket.io';

interface ReorderPayload {
  tripId: string;
  day: number;
  items: Array<{ id: string; order: number }>;
}

interface EditingPayload {
  tripId: string;
  itemId: string;
}

// Default membership checker uses DB (lazy import to avoid circular deps in test)
async function defaultCheckMembership(userId: string, tripId: string): Promise<boolean> {
  const { AppDataSource } = await import('../data-source');
  const { Trip } = await import('../modules/trips/trip.entity');
  const trip = await AppDataSource.getRepository(Trip).findOne({
    where: { id: tripId },
    select: ['id', 'members'] as any,
  });
  return trip?.members.some((m) => m.userId === userId) ?? false;
}

export function registerSocketHandlers(
  io: SocketIOServer,
  socket: Socket,
  checkMembership: (userId: string, tripId: string) => Promise<boolean> = defaultCheckMembership,
): void {
  const userId = socket.data.userId as string;
  const email = socket.data.email as string;
  const joinedTrips = new Set<string>(); // per-connection cache

  socket.on('join_trip', async (tripId: unknown) => {
    if (typeof tripId !== 'string' || !tripId.trim()) return;

    if (joinedTrips.has(tripId)) {
      void socket.join(`trip:${tripId}`);
      return;
    }

    try {
      const ok = await checkMembership(userId, tripId);
      if (!ok) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not a trip member' });
        return;
      }
      joinedTrips.add(tripId);
      void socket.join(`trip:${tripId}`);
      socket.to(`trip:${tripId}`).emit('user:joined', { userId, email, tripId });
    } catch {
      socket.emit('error', { code: 'INTERNAL' });
    }
  });

  socket.on('leave_trip', (tripId: unknown) => {
    if (typeof tripId !== 'string') return;
    joinedTrips.delete(tripId);
    void socket.leave(`trip:${tripId}`);
    socket.to(`trip:${tripId}`).emit('user:left', { userId, email, tripId });
  });

  // Presence-only relays (non-data, still validate membership via cache)
  socket.on('itinerary:reorder', (data: ReorderPayload) => {
    if (!joinedTrips.has(data?.tripId)) return;
    socket.to(`trip:${data.tripId}`).emit('itinerary:reorder', data);
  });

  socket.on('user:editing', (data: EditingPayload) => {
    if (!joinedTrips.has(data?.tripId)) return;
    socket.to(`trip:${data.tripId}`).emit('user:editing', { ...data, email });
  });

  socket.on('disconnect', () => {
    joinedTrips.clear();
  });
}
