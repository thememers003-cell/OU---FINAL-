// ============================================================
// WebSocket Client — Real-time connection for customer app
// ============================================================

import { io, Socket } from 'socket.io-client';
import { getApiUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getApiUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function joinSession(sessionId: string): void {
  const s = connectSocket();
  s.emit('join_session', { sessionId });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
