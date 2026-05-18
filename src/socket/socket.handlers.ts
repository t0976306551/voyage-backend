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

  socket.on('join_trip', async (tripId: unknown) => {
    if (typeof tripId !== 'string' || !tripId.trim()) return;

    try {
      const ok = checkMembership ? await checkMembership(userId, tripId) : true;
      if (!ok) {
        socket.leave(`trip:${tripId}`);
        socket.emit('error', { code: 'FORBIDDEN', message: 'Not a trip member' });
        return;
      }
      void socket.join(`trip:${tripId}`);
      socket.to(`trip:${tripId}`).emit('user:joined', { userId, email, tripId });
    } catch {
      socket.emit('error', { code: 'INTERNAL', message: 'Internal error' });
    }
  });

  socket.on('leave_trip', (tripId: unknown) => {
    if (typeof tripId !== 'string') return;
    void socket.leave(`trip:${tripId}`);
    socket.to(`trip:${tripId}`).emit('user:left', { userId, email, tripId });
  });

  // Presence-only relays — guard using actual socket room membership
  socket.on('itinerary:reorder', (data: ReorderPayload) => {
    if (!socket.rooms.has(`trip:${data?.tripId}`)) return;
    socket.to(`trip:${data.tripId}`).emit('itinerary:reorder', data);
  });

  socket.on('user:editing', (data: EditingPayload) => {
    if (!socket.rooms.has(`trip:${data?.tripId}`)) return;
    socket.to(`trip:${data.tripId}`).emit('user:editing', { ...data, email });
  });
}
