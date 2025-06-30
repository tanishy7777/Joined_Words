import { io } from 'socket.io-client';
import { auth } from './src/firebase/config';

// export const socket = io('http://localhost:3000', { autoConnect: false });
export const socket = io('https://jwbackend-production.up.railway.app', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
export const updateSocketAuth = async () => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();        // still fetch if you need token later
    socket.auth = {
      uid: user.uid,
      nickname: user.displayName || 'Anonymous'
    };
    socket.connect();                             // ⬅️ connect only after auth set
  } else {
    socket.disconnect();
  }
};
