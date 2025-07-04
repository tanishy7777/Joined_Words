import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;

import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data.json', 'utf-8'));

// Redis setup
import { Redis } from '@upstash/redis'
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})


// Authentication and Firebase Admin SDK setup
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let serviceAccount;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
  serviceAccount = JSON.parse(
    Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8')
  );
} else {
  // serviceAccount = require('./jwmultiplayer-firebase-adminsdk-2952g-1bfce059ed.json');
  serviceAccount = require('./jw-daily-firebase-adminsdk.json');
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"],       
        credentials: true, 
    },
});


app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
}));


app.get('/', (req, res) => {
    res.send('Hello World from Joined Words Server!');
});

io.use(async (socket, next) => {
  const { uid, nickname } = socket.handshake.auth;
  if (!uid || !nickname) {
    return next(new Error('Authentication required'));
  }
  socket.data.user = { uid, nickname };
  next();
});


// Game State Management with Redis
class GameStateManager {
    static async createRoom(roomId, initialState) {
      try{
        const key = `gamestate:${roomId}`;
        // await redisClient.setEx(key, 3600, JSON.stringify(initialState)); // 1 hour expiry
        await redisClient.set(key, JSON.stringify(initialState), { ex: 3600 });
        return roomId;
      } catch (error) {
        console.error('Redis set failed:', error);
        return null;
      }
    }

    static async getRoom(roomId) {
      try {
        const key = `gamestate:${roomId}`;
        const state = await redisClient.get(key);
        if (typeof state === 'string') {
          return JSON.parse(state);
        } else {
          return state;
        }
      } catch (error) {
        console.error('Redis get failed:', error);
        return null;
      }
    }
    static async updateRoom(roomId, updates) {
      try {
          const currentState = await this.getRoom(roomId);
          if (!currentState) return null;
          
          const updatedState = { ...currentState, ...updates };
          // await redisClient.setEx(`gamestate:${roomId}`, 3600, JSON.stringify(updatedState));
          await redisClient.set(`gamestate:${roomId}`, JSON.stringify(updatedState), { ex: 3600 });
          return updatedState;
      } catch (error) {
          console.error('Redis update failed:', error);
          return null;
      }
    }

    static async deleteRoom(roomId) {
        try {
          console.log(`Deleting room from Redis: ${roomId}`);
          await redisClient.del(`gamestate:${roomId}`);
        } catch (error) {
          console.error('Redis delete failed:', error);
        }
    }
}

// Periodic cleanup of public_rooms set (remove non-existent rooms)
// CHANGE: Interval now every 10 minutes
setInterval(async () => {
    const publicRooms = await redisClient.smembers('public_rooms');
    for (const roomId of publicRooms) {
        if (!(await redisClient.exists(`gamestate:${roomId}`))) {
            await redisClient.srem('public_rooms', roomId);
        }
    }
}, 10 * 60 * 1000); // Every 10 minutes


const RECONNECTION_GRACE_PERIOD = 5000; // 5 seconds
const playerReconnectionTimers = new Map(); // Track reconnection timers

async function generateUniqueRoomId() {
  let roomId;
  do {
    roomId = Math.random().toString(36).substring(2, 10); // 8-char alphanumeric ID
  } while (await GameStateManager.getRoom(roomId));
  return roomId;
}

function createInitialGameState({ uid, nickname, socket, data}) {
  const initialState = {
    questionIndex: 0,
    timer: null,
    score: { [uid]: 100 },
    data: data,
    players: {
      [uid]: {
        playerScore: 0,
        nickname: nickname,
        socketId: socket.id,
      }
    },
    admin: uid,
    totalWords: null,
    cluesAnswered: { [uid]: [false, false] },
    isPrivateGame: true,
    numOfWords: 3,
    timePerQuestion: 1,
    socketMap: { [uid]: socket.id },
  };

  return initialState;
}

function addPlayerToRoomState({ state, uid, nickname, socket }) {
  if (state.players[uid]) {
    console.warn(`Player with UID ${uid} ${nickname} is already in the room.`);
    return state; // Or throw error / skip silently
  }

  state.players[uid] = {
    playerScore: 0,
    nickname: nickname,
    socketId: socket.id,
  };

  state.score[uid] = 100;
  state.cluesAnswered[uid] = [false, false];
  state.socketMap[uid] = socket.id;

  return state;
}

function buildQuestionData(gameState) {
  const currentIndex = gameState.totalWords - gameState.numOfWords;
  const currentWordData = gameState.data[currentIndex];
  const questionData = {
    questionIndex: currentIndex,
    clue1: currentWordData.clue1,
    clue2: currentWordData.clue2,
    jwclue: currentWordData.jwclue,
  };
}

async function applyTimePenalty(roomId, penaltyAmount) {
  const currentState = await GameStateManager.getRoom(roomId);
  if (!currentState) {
    console.error(`Room not found in GameStateManager for roomID: ${roomId}`);
    return;
  }
  let needsUpdate = false;
  for (const playerId of Object.keys(currentState.players)) {
    const [clue1, clue2] = currentState.cluesAnswered[playerId] || [];
    if (!clue1 || clue2) {
      currentState.score[playerId] -= penaltyAmount;
      needsUpdate = true;

      const socketId = currentState.socketMap[playerId];
      if (socketId) {
        io.to(socketId).emit('score_update', currentState.score[playerId]);
      }
    }
  }

  if (needsUpdate) {
    await GameStateManager.updateRoom(roomId, { score: currentState.score });
  }
}

async function endRound(gameState, roomId, io, socket) {
  for (const playerId of Object.keys(gameState.players)) {
    gameState.players[playerId].answeredCorrectly = false;
  }

  await GameStateManager.updateRoom(roomId, gameState);
  io.to(roomId).emit('update_leaderboard', gameState.players);

  if (gameState.numOfWords > 0) {
    for (const playerId of Object.keys(gameState.players)) {
      gameState.score[playerId] = 100;
      const socketId = gameState.socketMap[playerId];
      if (socketId) {
        io.to(socketId).emit('clear_field_new_word');
      }
    }

    await GameStateManager.updateRoom(roomId, gameState);

    const adminSocketId = gameState.socketMap[gameState.admin];
    if (adminSocketId) {
      io.to(adminSocketId).emit("game_restart", {
        roomId,
        numOfWords: gameState.numOfWords,
        timePerQuestion: gameState.timePerQuestion,
      });
    }
    socket.broadcast.to(roomId).emit("next_word_in");
  } else {
    io.to(roomId).emit('end_game');
  }
}

io.on('connection',  (socket) => {
  const user = socket.data?.user;
  console.log(`🔌 New client connected: UID=${user?.uid || 'Unknown'}, Nickname=${user?.nickname || 'Unknown'}`);
   

  // Input: roomId
  // Output: { isAdmin: boolean, gameStarted: boolean }
  socket.on('get_room_info', async (roomId, callback) => {
    console.log(`[get_room_info] 🔍 Client requested room info for roomId: ${roomId}`);
    const gameState = await GameStateManager.getRoom(roomId);
    const { uid } = socket.data.user;
    if (!gameState || !uid) {
      return callback({ error: true, errorMessage: 'Room not found or user not authenticated' });
    }
    const isAdmin = (gameState.admin === uid);
    const gameStarted = (gameState.totalWords !== null);
    callback({ isAdmin, gameStarted });
  });
  
  // Input: {}
  // Output: { success: boolean, reason?: string, roomId?: string }
  socket.on('create_room', async (callback) => {
    console.log(`[create_room] 🏠 Client requested to create a new room`);
    const { uid, nickname } = socket.data.user;
    if (!uid) {
      console.error(`User ${nickname} (${uid}) tried to create a room without authentication`);
      return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
    }

    let roomId = await generateUniqueRoomId();
    const initialState = createInitialGameState({ uid, nickname, socket, data });

    // can remove as initilState is private by default
    // if (!initialState.isPrivateGame) {
    //     await redisClient.sadd('public_rooms', roomId);
    // }

    await GameStateManager.createRoom(roomId, initialState);
    socket.join(roomId);
    io.to(roomId).emit('update_leaderboard', initialState.players);
    callback({ success: true, roomId });
  });

  // Input: {}
  // Output: { success: boolean, reason?: string, roomId?: string }
  socket.on('join_random_room', async (callback) => {
    console.log(`[join_random_room] 🤝 Client requested to join a random public room`);
    const { uid, nickname } = socket.data.user;
    if (!uid) {
      console.error(`User ${nickname} (${uid}) tried to join a random room without authentication`);
      return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
    }

    const publicRoomIds = await redisClient.smembers('public_rooms');
    const availableRooms = [];
    
    for (const roomId of publicRoomIds) {
        const state = await GameStateManager.getRoom(roomId);
        // if public room exists and game hasnt started => available
        if (state && !state.isPrivateGame && state.totalWords === null) {
            availableRooms.push(roomId);
        }
    }

    if (availableRooms.length === 0) {
        callback({ success: false, reason: 'NO_PUBLIC_ROOMS' });
        return;
    }

    const randomRoomID = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    const currentState = await GameStateManager.getRoom(randomRoomID);
    currentState = addPlayerToRoomState({
        state: currentState,
        uid,
        nickname,
        socket
    });

    await GameStateManager.updateRoom(randomRoomID, currentState);
    socket.join(randomRoomID);
    io.to(randomRoomID).emit('update_leaderboard', currentState.players);
    callback({ success: true, roomId: randomRoomID });
  });

  // Input: roomId
  // Output: { success: boolean, reason?: string }
  socket.on('join_room', async (roomId, callback) => {
    console.log(`[join_room] 🏃 Client requested to join room: ${roomId}`);
    const { uid, nickname } = socket.data.user;
    if (!uid) {
      console.error(`User ${nickname} (${uid}) tried to join room ${roomId} without authentication`);
      return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
    }

    const currentState = await GameStateManager.getRoom(roomId);
    if (!currentState) {
      return callback({ success: false, reason: 'ROOM_NOT_FOUND' });
    }
    // Handles case if player already exists in the room
    currentState = addPlayerToRoomState({
        state: currentState,
        uid,
        nickname,
        socket
    });
    await GameStateManager.updateRoom(roomId, currentState);
    socket.join(roomId);
    io.to(roomId).emit('update_leaderboard', currentState.players);
    callback?.({ success: true });
  });

  // Input: roomId
  // Output: { }
  socket.on('get_leaderboard', async (roomId) => {
    console.log(`[get_leaderboard] 📊 Client requested leaderboard for room: ${roomId}`);
    const currentState = await GameStateManager.getRoom(roomId);
    if (currentState) {
        io.to(roomId).emit('update_leaderboard', currentState.players);
    }
  });

  // Input: roomId, config
  // Output: { }
  socket.on('update_config', async (roomId, config) => {
    console.log(`[update_config] ⚙️ Client requested to update config for room: ${roomId}`, config);
    const gameState = await GameStateManager.getRoom(roomId);
    if(!gameState) {
      console.error(`Game state not found for room ${roomId}`);
      return;
    }
    
    if (config.numOfWords !== undefined) {
      gameState.numOfWords = config.numOfWords;
    }
    if (config.timePerQuestion !== undefined) {
      gameState.timePerQuestion = config.timePerQuestion;
    }
    if (config.isPrivateGame !== undefined) {
      gameState.isPrivateGame = config.isPrivateGame;
      console.log(`Room ${roomId} privacy updated: ${config.isPrivateGame ? 'Private' : 'Public'}`);
      if (config.isPrivateGame) {
          await redisClient.srem('public_rooms', roomId);
      } else {
          await redisClient.sadd('public_rooms', roomId);
      }
    }
    await GameStateManager.updateRoom(roomId, gameState);
  });

  socket.on('start_game', async (roomId, isFirstRound) => {
    console.log(`[start_game] 🚀 Client requested to start game in room: ${roomId}, isFirstRound: ${isFirstRound}`);
    const gameState = await GameStateManager.getRoom(roomId);
    const { uid } = socket.data.user;
    if (!uid || !gameState) {
      console.error(`Game state not found for room ${roomId} or user not authenticated`);
      return;
    }

    let { numOfWords = 3, timePerQuestion = 1, isPrivateGame = false } = gameState;

    if (!isFirstRound) {
      io.to(roomId).emit('load_game_component');
      gameState.totalWords = numOfWords; // redundant?
      await GameStateManager.updateRoom(roomId, gameState);
    }

    const questionData = buildQuestionData(gameState);
    gameState.questionIndex = questionData.questionIndex;
    gameState.numOfWords = --numOfWords;

    // let totalTime = 60 * timePerQuestion; 
    let totalTime = 16;
    let countdownTime = totalTime;
    let timePenalty = 10;

    setTimeout(() => {
      io.to(roomId).emit('get_question_data', questionData);
      io.to(roomId).emit('get_score', gameState.score[uid]);
    }, 10);
    io.to(roomId).emit('game_started', countdownTime);

    const gameInterval = setInterval(async () => {
      countdownTime--;
      io.to(roomId).emit('update_timer', countdownTime);

      if ((totalTime - countdownTime) % 5 === 0) {
        await applyTimePenalty(roomId, timePenalty);
      }
      
      console.log(`[end_round] ⏰ Time's up for room: ${roomId}`);
      if (countdownTime <= 0) {
        clearInterval(gameInterval);
        await endRound(gameState, roomId, io, socket);
      }
    }, 1000);
  });
    
  // Input: { questionIndex, field, roomId }
  // Output: { }
  socket.on('check_clue_answer', async ({ questionIndex, field, roomId }) => {
    console.log(`[check_clue_answer] 🧩 Client checking clue answer for room: ${roomId}, questionIndex: ${questionIndex}, field: ${field}`);
    const gameState = await GameStateManager.getRoom(roomId);
    const { uid } = socket.data.user;
    if (!gameState || !uid) {
      console.error(`Game state not found for room ${roomId} or user not authenticated`);
      return;
    }

    const answer1 = gameState.data[questionIndex].answer1.toLowerCase();
    const answer2 = gameState.data[questionIndex].answer2.toLowerCase();
    const input = field.toLowerCase();

    if (input === answer1 && !gameState.cluesAnswered[uid][0]) {
      socket.emit('check_clue1_answer', answer1);
      gameState.cluesAnswered[uid][0] = true;
      updated = true;
      console.log(`✅ Player ${uid} answered clue1 correctly`);
    }else if (input === answer2 && !gameState.cluesAnswered[uid][1]) {
      socket.emit('check_clue2_answer', answer2);
      gameState.cluesAnswered[uid][1] = true;
      updated = true;
      console.log(`✅ Player ${uid} answered clue2 correctly`);
    }else if (input === answer1 + answer2 && (!gameState.cluesAnswered[uid][0] || !gameState.cluesAnswered[uid][1])) {
      socket.emit('check_clue1_answer', answer1);
      socket.emit('check_clue2_answer', answer2);
      gameState.cluesAnswered[uid][0] = true;
      gameState.cluesAnswered[uid][1] = true;
      updated = true;
      console.log(`✅ Player ${uid} answered both clues together`);
    }else {
      socket.emit('check_clue1_answer', null);  
      console.log(`❌ Player ${uid} gave incorrect clue answer`);
    } 

    const [clue1Done, clue2Done] = gameState.cluesAnswered[uid];
    if (clue1Done && clue2Done && !gameState.players[uid].answeredCorrectly) {
      gameState.players[uid].answeredCorrectly = true;
      gameState.players[uid].playerScore += gameState.score[uid];
      io.to(roomId).emit('update_leaderboard', gameState.players);
      console.log(`🎯 Player ${uid} fully answered correctly for Q${questionIndex}`);
      updated = true;
    }

    if (updated) {
      await GameStateManager.updateRoom(roomId, gameState);
    }
  });

  // async function cleanupPlayerDisconnect(socket, roomId, uid, nickname, isReload = false) {
  //   try {      
  //     const gameState = await GameStateManager.getRoom(roomId);
  //     if (!gameState) {
  //       console.log(`Room ${roomId} not found during cleanup`);
  //       return;
  //     }

  //     if (isReload) {
  //       console.log(`Setting reconnection grace period for ${nickname} in room ${roomId}`);
        
  //       // CRITICAL FIX: Clear socket mapping for this player
  //       if (gameState.socketMap && gameState.socketMap[uid]) {
  //         delete gameState.socketMap[uid];
  //         // Persist this change immediately
  //         await GameStateManager.updateRoom(roomId, gameState);
  //         console.log(`Cleared socket mapping for ${nickname}`);
  //       }
        
  //       // Timer management
  //       const timerKey = `${uid}_${roomId}`;
  //       if (playerReconnectionTimers.has(timerKey)) {
  //         clearTimeout(playerReconnectionTimers.get(timerKey));
  //       }
        
  //       const timer = setTimeout(async () => {
  //         console.log(`Grace period expired for ${nickname}, removing from room ${roomId}`);
  //         await actuallyRemovePlayer(roomId, uid, nickname);
  //         playerReconnectionTimers.delete(timerKey);
  //       }, RECONNECTION_GRACE_PERIOD);
        
  //       playerReconnectionTimers.set(timerKey, timer);
  //       socket.leave(roomId);
  //       sendSystemMessage(roomId, `${nickname} disconnected (may reconnect...)`);
  //       return;
  //     }
      
  //     // Tab close handling
  //     await actuallyRemovePlayer(roomId, uid, nickname);
  //     socket.leave(roomId);
      
  //   } catch (error) {
  //     console.error(`Error cleaning up player ${uid} from room ${roomId}:`, error);
  //   }
  // }

  // // NEW: Actual player removal logic
  // async function actuallyRemovePlayer(roomId, uid, nickname) {
  //   const gameState = await GameStateManager.getRoom(roomId);
  //   if (!gameState) return;

  //   // Remove player from game state
  //   if (gameState.players[uid]) {
  //     delete gameState.players[uid];
  //     delete gameState.score[uid];
  //     delete gameState.cluesAnswered[uid];
  //     delete gameState.socketMap[uid];
  //   }

  //   // Check if room is now empty
  //   const remainingPlayers = Object.keys(gameState.players);
  //   console.log(`Remaining players in room ${roomId}:`, remainingPlayers.length);
    
  //   if (remainingPlayers.length === 0) {
  //     // No players left - delete the room entirely
  //     console.log(`Deleting empty room: ${roomId}`);
  //     await GameStateManager.deleteRoom(roomId);
  //     await redisClient.srem('public_rooms', roomId);
      
  //     // Clean up any pending invitations for this room
  //     const invitationKeys = await redisClient.keys(`game_invitation:*`);
  //     for (const key of invitationKeys) {
  //       const invitationData = await redisClient.get(key);
  //       if (invitationData) {
  //         const invitation = JSON.parse(invitationData);
  //         if (invitation.roomId === roomId) {
  //           await redisClient.del(key);
  //         }
  //       }
  //     }
  //   } else {
  //     console.log(`Player ${nickname} left room ${roomId}. ${remainingPlayers.length} players remaining.`);
      
  //     // If the disconnected player was admin, assign new admin
  //     if (gameState.admin === uid) {
  //       const newAdmin = remainingPlayers[0];
  //       gameState.admin = newAdmin;
  //       console.log(`New admin for room ${roomId}: ${newAdmin}`);
        
  //       const newAdminSocketId = gameState.socketMap[newAdmin];
  //       if (newAdminSocketId) {
  //         sendSystemMessage(roomId, `${gameState.players[newAdmin]?.nickname || 'Someone'} is now the admin`);
  //         io.to(newAdminSocketId).emit('became_admin', {
  //           uid: newAdmin,
  //           nickname: gameState.players[newAdmin]?.nickname || "Unknown"
  //         });
  //         io.to(roomId).emit('admin_changed', {
  //           uid: newAdmin,
  //           nickname: gameState.players[newAdmin]?.nickname || "Unknown"
  //         });
  //       }
  //     }
      
  //     // Update Redis with new state
  //     await GameStateManager.updateRoom(roomId, gameState);
      
  //     // Notify remaining players
  //     io.to(roomId).emit('update_leaderboard', gameState.players);
  //     sendSystemMessage(roomId, `${nickname} left the game`);
  //     io.to(roomId).emit('player_disconnected', {
  //       uid,
  //       nickname,
  //       remainingPlayers: remainingPlayers.length
  //     });
  //   }
  // }

  // // Replace the disconnect handler with this:
  // socket.on('disconnecting', async (reason) => {
  //     const { uid, nickname } = socket.data.user || {};
  //     if (!uid) {
  //       console.log('Client disconnecting (unauthenticated)');
  //       return;
  //     }

  //     console.log(`Client disconnecting: ${nickname} (${uid}), reason: ${reason}`);
      
  //     // Detect if this is likely a page reload vs tab close
  //     const isReload = reason === 'transport close' || reason === 'client namespace disconnect';
      
  //     const currentRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
  //     console.log(`Player ${nickname} (${uid}) disconnecting from rooms:`, currentRooms);
      
  //     for (const roomId of currentRooms) {
  //       await cleanupPlayerDisconnect(socket, roomId, uid, nickname, isReload);
  //     }

  //     await notifyFriendsStatusUpdate(uid);
  // });

  // Keep this for logging (optional)
  socket.on('disconnect', () => {
    console.log('Client fully disconnected');
  });
});

// TODO: Use react router to have shareable links for rooms
server.listen(PORT, '0.0.0.0', () => {
  console.log(`server running at http://localhost:${PORT}`);
});


