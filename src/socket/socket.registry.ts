/**
 * socket.registry.ts
 * Module-level userId → socketIds mapping.
 * Imported by both socket.service.ts and broadcaster.ts to avoid circular deps.
 */

const userSocketMap = new Map<string, Set<string>>();

export function registerSocket(userId: string, socketId: string): void {
  if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
  userSocketMap.get(userId)!.add(socketId);
}

export function unregisterSocket(userId: string, socketId: string): void {
  userSocketMap.get(userId)?.delete(socketId);
  if (userSocketMap.get(userId)?.size === 0) userSocketMap.delete(userId);
}

export function getSocketIdsByUserId(userId: string): string[] {
  return Array.from(userSocketMap.get(userId) ?? []);
}
