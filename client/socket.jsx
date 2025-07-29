import { io } from 'socket.io-client';
import { auth } from './src/firebase/config';


export const socket = io('http://localhost:3000', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
socket.on('connect_error', (err) => {
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
      nickname: user.displayName 
    };
    if (!socket.connected) {
      socket.connect();
    }
  } else {
    socket.disconnect();
  }
};
