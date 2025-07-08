import { io } from 'socket.io-client';
import { auth } from './src/firebase/config';

// export const socket = io('http://localhost:3000', { autoConnect: false });
// export const socket = io('https://jwbackend-production.up.railway.app', {
//   autoConnect: false,
//   transports: ['websocket', 'polling'],
// });

export const socket = io('http://localhost:3000', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
// In the same file where you define your socket
socket.on('connect_error', (err) => {
  // This will likely log "Authentication required"
  console.error('[Socket Connect Error]', err.message);
});

socket.on('connect', () => {
  console.log('%c[Socket] Successfully connected!', 'color: blue; font-weight: bold;');
});

export const updateSocketAuth = async (user) => { 
  if (user && user.uid && user.displayName) {
    console.log(`Setting socket auth with Nickname: ${user.displayName}`);
    socket.auth = {
      uid: user.uid,
      nickname: user.displayName // No more fallback needed
    };
    // Only connect if not already connecting or connected
    if (!socket.connected) {
      socket.connect();
    }
  } else {
    socket.disconnect();
  }
};
