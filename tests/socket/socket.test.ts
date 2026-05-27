import { createServer } from 'http';
import { createHmac } from 'crypto';
import { AddressInfo } from 'net';
import express from 'express';
import { io as clientIO, Socket as ClientSocket } from 'socket.io-client';
import { initSocketIO } from '../../src/socket/socket.service';
import { broadcastToTrip } from '../../src/socket/broadcaster';

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
const TEST_SECRET = 'super-secret-key-for-nextauth-min-32-chars';

function makeJwt(sub: string, email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub, email, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const sig = createHmac('sha256', TEST_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Resolve when socket emits `event`, or reject after `timeout` ms. */
function waitFor<T>(socket: ClientSocket, event: string, timeout = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

/** Resolve after `ms` with no event received; reject if the event fires. */
function expectNoEvent(socket: ClientSocket, event: string, ms = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    socket.once(event, () => {
      clearTimeout(t);
      reject(new Error(`Unexpected event: "${event}"`));
    });
  });
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

interface ServerHandle {
  url: string;
  close: () => Promise<void>;
}

function setupServer(
  checkMembership: (userId: string, tripId: string) => Promise<boolean>,
): Promise<ServerHandle> {
  return new Promise((resolve) => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    const app = express();
    const srv = createServer(app);
    initSocketIO(srv, { checkMembership });
    srv.listen(0, () => {
      const { port } = srv.address() as AddressInfo;
      resolve({
        url: `http://localhost:${port}`,
        close: () => new Promise((r) => srv.close(() => r())),
      });
    });
  });
}

/** Open a client and wait until it is connected (or reject on connect_error). */
function connectClient(url: string, token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = clientIO(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.disconnect();
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Tier 1 – Basic Auth
// ---------------------------------------------------------------------------

describe('Tier 1: Basic Auth', () => {
  let server: ServerHandle;

  beforeAll(async () => {
    server = await setupServer(async () => true); // auth tests don't reach membership check
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects connection without token → connect_error "Unauthorized"', (done) => {
    const socket = clientIO(server.url, { auth: {}, transports: ['websocket'], reconnection: false });
    socket.once('connect_error', (err) => {
      expect(err.message).toBe('Unauthorized');
      socket.disconnect();
      done();
    });
    socket.once('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected'));
    });
  });

  it('rejects connection with invalid token → connect_error "Unauthorized"', (done) => {
    const socket = clientIO(server.url, {
      auth: { token: 'not.a.valid.jwt' },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect_error', (err) => {
      expect(err.message).toBe('Unauthorized');
      socket.disconnect();
      done();
    });
    socket.once('connect', () => {
      socket.disconnect();
      done(new Error('Should not have connected'));
    });
  });

  it('accepts connection with valid JWT', async () => {
    const socket = await connectClient(server.url, makeJwt('user-1', 'a@test.com'));
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Tier 2 – join_trip membership validation
// ---------------------------------------------------------------------------

describe('Tier 2: join_trip membership validation', () => {
  let server: ServerHandle;

  // member: user-member in trip-aaa; everyone else denied
  const MEMBER_USER = 'user-member';
  const MEMBER_TRIP = 'trip-aaa';

  let checkMembership: jest.Mock<Promise<boolean>, [string, string]>;

  beforeAll(async () => {
    checkMembership = jest.fn(async (userId, tripId) => {
      return userId === MEMBER_USER && tripId === MEMBER_TRIP;
    });
    server = await setupServer(checkMembership);
  });

  afterAll(async () => {
    await server.close();
  });

  it('member join_trip succeeds (no error event)', async () => {
    const socket = await connectClient(server.url, makeJwt(MEMBER_USER, 'member@test.com'));
    try {
      const noError = expectNoEvent(socket, 'error', 300);
      socket.emit('join_trip', MEMBER_TRIP);
      await noError; // if an error fires, promise rejects → test fails
    } finally {
      socket.disconnect();
    }
  });

  it('non-member join_trip → receives error { code: "FORBIDDEN" }', async () => {
    const socket = await connectClient(server.url, makeJwt('user-outsider', 'out@test.com'));
    try {
      socket.emit('join_trip', MEMBER_TRIP);
      const err = await waitFor<{ code: string }>(socket, 'error');
      expect(err.code).toBe('FORBIDDEN');
    } finally {
      socket.disconnect();
    }
  });

  it('non-member join_trip → broadcast inside trip room is NOT received', async () => {
    // Member joins the room to receive broadcasts
    const member = await connectClient(server.url, makeJwt(MEMBER_USER, 'member@test.com'));
    // Outsider tries to join
    const outsider = await connectClient(server.url, makeJwt('user-outsider2', 'out2@test.com'));

    try {
      // Member joins successfully
      member.emit('join_trip', MEMBER_TRIP);
      await new Promise((r) => setTimeout(r, 150)); // let join settle

      // Outsider tries to join → gets FORBIDDEN, is not in the room
      outsider.emit('join_trip', MEMBER_TRIP);
      await waitFor<{ code: string }>(outsider, 'error');

      // Now outsider tries to send a relay event inside the trip room
      // (won't be in joinedTrips → silently dropped)
      const noEvent = expectNoEvent(member, 'itinerary:reorder', 400);
      outsider.emit('itinerary:reorder', {
        tripId: MEMBER_TRIP,
        day: 1,
        items: [{ id: 'item-x', order: 0 }],
      });
      await noEvent;
    } finally {
      member.disconnect();
      outsider.disconnect();
    }
  });

  it('same socket join_trip twice → checkMembership called only once (cache hit)', async () => {
    checkMembership.mockClear();
    const socket = await connectClient(server.url, makeJwt(MEMBER_USER, 'member@test.com'));
    try {
      // Use ack to guarantee the first join is fully processed (room joined, checkMembership
      // resolved) before the second emit — eliminates the timing race entirely.
      await new Promise<void>((resolve) => socket.emit('join_trip', MEMBER_TRIP, resolve));

      // Second join should short-circuit via socket.rooms.has() before touching checkMembership.
      await new Promise<void>((resolve) => socket.emit('join_trip', MEMBER_TRIP, resolve));

      expect(checkMembership).toHaveBeenCalledTimes(1);
    } finally {
      socket.disconnect();
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 3 – Room isolation (security)
// ---------------------------------------------------------------------------

describe('Tier 3: Room isolation', () => {
  let server: ServerHandle;

  const TRIP_A = 'trip-AAA';
  const TRIP_B = 'trip-BBB';
  const USER_A = 'user-A';
  const USER_B = 'user-B';

  beforeAll(async () => {
    server = await setupServer(async () => true); // everyone is a member
  });

  afterAll(async () => {
    await server.close();
  });

  it("User A's itinerary:reorder is NOT received by User B in a different trip", async () => {
    const clientA = await connectClient(server.url, makeJwt(USER_A, 'a@test.com'));
    const clientB = await connectClient(server.url, makeJwt(USER_B, 'b@test.com'));

    try {
      clientA.emit('join_trip', TRIP_A);
      clientB.emit('join_trip', TRIP_B);
      await new Promise((r) => setTimeout(r, 150));

      const noEvent = expectNoEvent(clientB, 'itinerary:reorder', 400);
      clientA.emit('itinerary:reorder', {
        tripId: TRIP_A,
        day: 1,
        items: [{ id: 'x', order: 0 }],
      });
      await noEvent;
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('broadcastToTrip to trip-AAA is NOT received by socket in trip-BBB', async () => {
    const clientA = await connectClient(server.url, makeJwt(USER_A, 'a@test.com'));
    const clientB = await connectClient(server.url, makeJwt(USER_B, 'b@test.com'));

    try {
      clientA.emit('join_trip', TRIP_A);
      clientB.emit('join_trip', TRIP_B);
      await new Promise((r) => setTimeout(r, 150));

      const noEvent = expectNoEvent(clientB, 'trip:data:updated', 400);
      broadcastToTrip(TRIP_A, 'trip:data:updated', { tripId: TRIP_A, msg: 'hello' });
      await noEvent;
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 4 – Relay event validation
// ---------------------------------------------------------------------------

describe('Tier 4: Relay events', () => {
  let server: ServerHandle;

  beforeAll(async () => {
    server = await setupServer(async () => true); // everyone is a member
  });

  afterAll(async () => {
    await server.close();
  });

  it('member sends itinerary:reorder → other member receives it', async () => {
    const clientA = await connectClient(server.url, makeJwt('userA', 'a@test.com'));
    const clientB = await connectClient(server.url, makeJwt('userB', 'b@test.com'));
    const tripId = 'trip-relay-1';

    try {
      clientA.emit('join_trip', tripId);
      clientB.emit('join_trip', tripId);
      await new Promise((r) => setTimeout(r, 150));

      const payload = { tripId, day: 2, items: [{ id: 'item-1', order: 0 }] };
      const received = waitFor<typeof payload>(clientB, 'itinerary:reorder');
      clientA.emit('itinerary:reorder', payload);
      const data = await received;
      expect(data).toEqual(payload);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('socket that has NOT joined trip emits itinerary:reorder → event is dropped (others do NOT receive it)', async () => {
    const clientA = await connectClient(server.url, makeJwt('userA', 'a@test.com')); // joined
    const clientC = await connectClient(server.url, makeJwt('userC', 'c@test.com')); // NOT joined
    const tripId = 'trip-relay-2';

    try {
      clientA.emit('join_trip', tripId);
      await new Promise((r) => setTimeout(r, 150));
      // clientC deliberately does NOT join

      const noEvent = expectNoEvent(clientA, 'itinerary:reorder', 400);
      clientC.emit('itinerary:reorder', {
        tripId,
        day: 1,
        items: [{ id: 'item-y', order: 0 }],
      });
      await noEvent;
    } finally {
      clientA.disconnect();
      clientC.disconnect();
    }
  });

  it('member sends user:editing → other member receives it with email injected', async () => {
    const clientA = await connectClient(server.url, makeJwt('userA', 'sender@test.com'));
    const clientB = await connectClient(server.url, makeJwt('userB', 'receiver@test.com'));
    const tripId = 'trip-relay-3';

    try {
      clientA.emit('join_trip', tripId);
      clientB.emit('join_trip', tripId);
      await new Promise((r) => setTimeout(r, 150));

      const received = waitFor<{ tripId: string; itemId: string; email: string }>(
        clientB,
        'user:editing',
      );
      clientA.emit('user:editing', { tripId, itemId: 'item-xyz' });
      const data = await received;
      expect(data.tripId).toBe(tripId);
      expect(data.itemId).toBe('item-xyz');
      expect(data.email).toBe('sender@test.com'); // server injects email from JWT
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('checklist:item:created is NOT relayed (server-authoritative; socket handler removed)', async () => {
    const clientA = await connectClient(server.url, makeJwt('userA', 'a@test.com'));
    const clientB = await connectClient(server.url, makeJwt('userB', 'b@test.com'));
    const tripId = 'trip-relay-4';

    try {
      clientA.emit('join_trip', tripId);
      clientB.emit('join_trip', tripId);
      await new Promise((r) => setTimeout(r, 150));

      const noEvent = expectNoEvent(clientB, 'checklist:item:created', 400);
      clientA.emit('checklist:item:created', { tripId, item: { id: 'chk-1', text: 'Pack bags' } });
      await noEvent; // socket relay has been removed; B should stay silent
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 5 – Edge cases
// ---------------------------------------------------------------------------

describe('Tier 5: Edge cases', () => {
  let server: ServerHandle;
  let checkMembership: jest.Mock<Promise<boolean>, [string, string]>;

  beforeAll(async () => {
    checkMembership = jest.fn(async (_userId: string, _tripId: string) => true);
    server = await setupServer(checkMembership);
  });

  afterAll(async () => {
    await server.close();
  });

  it('join_trip with empty string → dropped silently (no error, no join)', async () => {
    checkMembership.mockClear();
    const socket = await connectClient(server.url, makeJwt('user-e1', 'e1@test.com'));
    try {
      const noError = expectNoEvent(socket, 'error', 300);
      socket.emit('join_trip', '');
      await noError;
      expect(checkMembership).not.toHaveBeenCalled();
    } finally {
      socket.disconnect();
    }
  });

  it('join_trip with null → dropped silently (no error, no join)', async () => {
    checkMembership.mockClear();
    const socket = await connectClient(server.url, makeJwt('user-e2', 'e2@test.com'));
    try {
      const noError = expectNoEvent(socket, 'error', 300);
      socket.emit('join_trip', null);
      await noError;
      expect(checkMembership).not.toHaveBeenCalled();
    } finally {
      socket.disconnect();
    }
  });

  it('join_trip with number → dropped silently', async () => {
    checkMembership.mockClear();
    const socket = await connectClient(server.url, makeJwt('user-e3', 'e3@test.com'));
    try {
      const noError = expectNoEvent(socket, 'error', 300);
      socket.emit('join_trip', 12345);
      await noError;
      expect(checkMembership).not.toHaveBeenCalled();
    } finally {
      socket.disconnect();
    }
  });

  it('after disconnect, server broadcastToTrip does not reach the disconnected socket', async () => {
    const tripId = 'trip-edge-disconnect';

    const socket = await connectClient(server.url, makeJwt('user-e4', 'e4@test.com'));
    socket.emit('join_trip', tripId);
    await new Promise((r) => setTimeout(r, 150));

    // Collect any events received AFTER disconnect
    const received: unknown[] = [];
    socket.on('trip:data:updated', (d) => received.push(d));

    socket.disconnect();
    await new Promise((r) => setTimeout(r, 100)); // let disconnect propagate

    broadcastToTrip(tripId, 'trip:data:updated', { tripId, msg: 'after-disconnect' });
    await new Promise((r) => setTimeout(r, 300)); // give time for any stray delivery

    expect(received).toHaveLength(0);
  });
});
