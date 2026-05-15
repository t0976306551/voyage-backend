import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyHS256 } from '../shared/utils/jwt.utils';
import { registerSocketHandlers } from './socket.handlers';
import { setIO } from './broadcaster';

interface SocketInitOpts {
  checkMembership?: (userId: string, tripId: string) => Promise<boolean>;
}

export function initSocketIO(httpServer: HttpServer, opts?: SocketInitOpts): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return next(new Error('Server misconfiguration'));

    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = verifyHS256(token, secret);
      const sub = payload['sub'];
      const email = payload['email'];
      if (typeof sub !== 'string' || typeof email !== 'string') {
        return next(new Error('Unauthorized'));
      }
      socket.data.userId = sub;
      socket.data.email = email;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    registerSocketHandlers(io, socket, opts?.checkMembership);
  });

  setIO(io);
  return io;
}
