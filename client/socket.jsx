import { io } from 'socket.io-client';
import { auth } from './src/firebase/config';

export const socket = io('http://localhost:3000', { autoConnect: false });

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
