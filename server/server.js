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
  serviceAccount = require('./jwmultiplayer-firebase-adminsdk-2952g-1bfce059ed.json');
  // serviceAccount = require('./jw-daily-firebase-adminsdk.json');
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
  console.log(`Socket connection attempt from UID: ${uid}, Nickname: ${nickname}`);
  if (!uid || !nickname) {
    console.error('Authentication failed: UID or nickname missing');
    return next(new Error('Authentication required'));
  }
  console.log(`Authenticated user: ${uid}, Nickname: ${nickname}`);
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

    static async getAllRooms() {
      try {
        const keys = await redisClient.keys('gamestate:*');
        const roomIds = keys.map(key => key.replace('gamestate:', ''));
        return roomIds;
      } catch (error) {
        console.error('Redis getAllRooms failed:', error);
        return [];
      }
    }
}

(async () => {
  try {
    const allRoomIds = await GameStateManager.getAllRooms();
    for (const roomId of allRoomIds) {
      await GameStateManager.deleteRoom(roomId);
    }
    console.log(`✅ Cleared ${allRoomIds.length} game rooms from Redis on startup`);
  } catch (error) {
    console.error('Failed to clear rooms on startup:', error);
  }
})();


// Periodic cleanup of public_rooms set (remove non-existent rooms)
// CHANGE: Interval now every 10 minutes (was 100 minutes)
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


io.on('connection',  async (socket) => {
  // const gameState = await GameStateManager.getAllRooms();
  // NEVER AWAIT HERE!!!!!!
  console.log('New client connected');    
  socket.on('request_initial_game_state', async (roomId) => {
      console.log(`Socket ${socket.id} is requesting initial state for room ${roomId}`);
      const { uid } = socket.data.user || {};
      const currentState = await GameStateManager.getRoom(roomId);

      if (!currentState || !uid || currentState.totalWords === null) {
          console.error("Failed to provide initial state: game not running or invalid state.");
          return;
      }

      // This is the SAME logic that used to be in the 'join_room' handler
      const currentQuestionIndex = currentState.questionIndex;
      const questionData = {
        questionIndex: currentQuestionIndex,
        clue1: currentState.data[currentQuestionIndex].clue1,
        clue2: currentState.data[currentQuestionIndex].clue2,
        jwclue: currentState.data[currentQuestionIndex].jwclue,
      };
      
      const cluesAnswered = currentState.cluesAnswered[uid] || [false, false];
      const [clue1Answered, clue2Answered] = cluesAnswered;
      const playerSyncData = {
        score: currentState.score[uid],
        answer1: clue1Answered ? currentState.data[currentQuestionIndex].answer1 : null,
        answer2: clue2Answered ? currentState.data[currentQuestionIndex].answer2 : null,
      };

      io.to(socket.id).emit('get_question_data', questionData);
      io.to(socket.id).emit('player_state_sync', playerSyncData);
      io.to(socket.id).emit('get_score', currentState.score[uid]);
    });

    // Set up the socket data with user info
    socket.on('get_room_info', async (roomId, callback) => {
      const gameState = await GameStateManager.getRoom(roomId);
      console.log(`Fetching room info for roomId: ${roomId}, gameState:`, gameState.admin);

      const { uid } = socket.data.user;
      if (!gameState || !uid) {
        return callback({ error: true });
      }
      const isAdmin = gameState.admin === uid;
      const gameStarted = gameState.totalWords !== null;
      callback({ isAdmin, gameStarted });
    });
  
    socket.on('create_room', async (callback) => {
        const { uid, nickname } = socket.data.user;         
        if (!uid) {
          return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
        }

        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 10);
        } while (await GameStateManager.getRoom(roomId));

        const initialState = {
            questionIndex: 0,
            timer: null,
            score: {},
            data: data,
            players: {},
            admin: uid,
            totalWords: null,
            cluesAnswered: {},
            isPrivateGame: true,
            numOfWords: 3,
            timePerQuestion: 1,
            socketMap: {},
        };

        initialState.players[uid] = {
            playerScore: 0,
            nickname: nickname,
            socketId: socket.id
        };
        initialState.score[uid] = 100;
        initialState.cluesAnswered[uid] = [false, false];
        initialState.socketMap[uid] = socket.id;

        if (!initialState.isPrivateGame) {
            await redisClient.sadd('public_rooms', roomId);
        }

        await GameStateManager.createRoom(roomId, initialState);
        socket.join(roomId);
        io.to(roomId).emit('update_leaderboard', initialState.players);
        callback({ success: true, roomId });
    });

    // FIXED: Join random room handler
    socket.on('join_random_room', async (callback) => {
        const { uid, nickname } = socket.data.user;
        if (!uid) {
          return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
        }

        const publicRoomIds = await redisClient.smembers('public_rooms');
        const availableRooms = [];
        
        for (const roomId of publicRoomIds) {
            const state = await GameStateManager.getRoom(roomId);
            if (state && !state.isPrivateGame && state.totalWords === null) {
                availableRooms.push(roomId);
            }
        }

        if (availableRooms.length === 0) {
            callback({ success: false, reason: 'NO_PUBLIC_ROOMS' });
            return;
        }

        const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
        const currentState = await GameStateManager.getRoom(randomRoom);

        // FIXED: Use Firebase UID instead of socket.id
        currentState.players[uid] = {
            playerScore: 0,
            nickname: nickname,
            socketId: socket.id
        };
        currentState.score[uid] = 100;
        currentState.cluesAnswered[uid] = [false, false];
        currentState.socketMap[uid] = socket.id;

        await GameStateManager.updateRoom(randomRoom, currentState);
        socket.join(randomRoom);
        io.to(randomRoom).emit('update_leaderboard', currentState.players);
        callback({ success: true, roomId: randomRoom });
    });

    
    socket.on('join_room', async (roomId, callback) => {
      console.log(`Received 'join_room' for room: ${roomId}`);
      const { uid, nickname } = socket.handshake.auth;
      if (!uid) {
        console.error(`Client ${socket.id} not authenticated`);
        callback?.({ success: false, reason: 'NOT_AUTHENTICATED' });
        return;
      }

      const currentState = await GameStateManager.getRoom(roomId);
      if (!currentState) {
        console.error(`Room ${roomId} not found for client ${socket.id}`);
        callback?.({ success: false, reason: 'ROOM_NOT_FOUND' });
        return;
      }

      const isAdmin = currentState.admin === uid;
      const gameStarted = currentState.totalWords !== null;

      // Reconnection: player exists, but not mapped to a socket
      const isReconnection = !!currentState.players[uid] && !currentState.socketMap[uid];
      if (isReconnection) {
        const timerKey = `${uid}_${roomId}`;
        if (playerReconnectionTimers.has(timerKey)) {
          clearTimeout(playerReconnectionTimers.get(timerKey));
          playerReconnectionTimers.delete(timerKey);
          console.log(`Reconnection grace period cleared for ${nickname} in room ${roomId}`);
        }
        currentState.socketMap[uid] = socket.id;
        await GameStateManager.updateRoom(roomId, currentState);
        socket.join(roomId);
        io.to(roomId).emit('update_leaderboard', currentState.players);
        
        return callback?.({ 
            success: true, 
            isReconnection: true,
            gameStarted: gameStarted,
            isAdmin: isAdmin
        });
      }

      // Already present and connected: do nothing (idempotent)
      if (currentState.players[uid] && currentState.socketMap[uid]) {
        socket.join(roomId);
        return callback?.({ 
          success: true,
          alreadyPresent: true,
          gameStarted: gameStarted,
          isAdmin: isAdmin
        });
      }

      // New player
      if (!currentState.players[uid]) {
        currentState.players[uid] = {
          playerScore: 0,
          nickname,
          socketId: socket.id
        };
        currentState.score[uid] = 100;
        currentState.cluesAnswered[uid] = [false, false];
      }
      currentState.socketMap[uid] = socket.id;
      await GameStateManager.updateRoom(roomId, currentState);
      socket.join(roomId);
      io.to(roomId).emit('update_leaderboard', currentState.players);
      callback?.({ 
        success: true, 
        isNewPlayer: true,
        gameStarted: gameStarted,
        isAdmin: isAdmin
      });
    });


    

    socket.on('get_leaderboard', async (roomId) => {
      const currentState = await GameStateManager.getRoom(roomId);
      if (currentState) {
          io.to(roomId).emit('update_leaderboard', currentState.players);
      }
    });

    socket.on('update_config', async (roomId, config) => {
      const gameState = await GameStateManager.getRoom(roomId);
      if (gameState) {
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
        // Update Redis with the new game state
        await GameStateManager.updateRoom(roomId, gameState);
      }
});

    socket.on('start_game', async (roomId, isLoop, callback) => {
        const gameState = await GameStateManager.getRoom(roomId);
        if (!gameState) {
          if (typeof callback === 'function') {
            return callback({ success: false, reason: 'ROOM_NOT_FOUND' });
          }
          return;
        }

        const { uid } = socket.data.user;
        if (!uid) {
          if (typeof callback === 'function') {
            return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
          }
          return;
        }

        let { numOfWords = 3, timePerQuestion = 1, isPrivateGame = false } = gameState;

        if (!isLoop) {
            io.to(roomId).emit('load_game_component');
            gameState.totalWords = numOfWords;
            await GameStateManager.updateRoom(roomId, gameState);
        }

        
        const questionData = {
          questionIndex: gameState.totalWords - numOfWords,
          clue1: gameState.data[gameState.totalWords - numOfWords].clue1,
          clue2: gameState.data[gameState.totalWords - numOfWords].clue2,
          jwclue: gameState.data[gameState.totalWords - numOfWords].jwclue,
        };
        
        
        gameState.questionIndex = gameState.totalWords - numOfWords;
        numOfWords--;
        gameState.numOfWords = numOfWords;
        await GameStateManager.updateRoom(roomId, gameState);
        let totalTime = 16;
        let countdownTime = totalTime;
        let timePenalty = 10;

        setTimeout(() => {
            io.to(roomId).emit('get_question_data', questionData);
            io.to(roomId).emit('get_score', gameState.score[uid]);
        }, 10);

        if (typeof callback === 'function') {
          callback({ success: true });
        }
        io.to(roomId).emit('game_started', countdownTime);

        const gameInterval = setInterval(async () => {
            countdownTime--;
            io.to(roomId).emit('update_timer', countdownTime);

            if ((totalTime - countdownTime) % 5 === 0) {
              const currentState = await GameStateManager.getRoom(roomId);
              if (!currentState) return;
              
              let needsUpdate = false;
              
              for (const playerId of Object.keys(currentState.players)) {
                const [clue1, clue2] = currentState.cluesAnswered[playerId] || [];

                if (!clue1 || !clue2) {
                  currentState.score[playerId] -= timePenalty;
                  needsUpdate = true;
                  
                  const playerSocketId = currentState.socketMap[playerId];
                  if (playerSocketId) {
                    io.to(playerSocketId).emit('score_update', currentState.score[playerId]);
                  }
                }
              }
              if (needsUpdate) {
                await GameStateManager.updateRoom(roomId, {
                  score: currentState.score
                });
              }
            }
            if (countdownTime <= 0) {
              clearInterval(gameInterval);
              const currentState = await GameStateManager.getRoom(roomId);
              try {
                console.log(currentState.players);
                io.to(roomId).emit('update_leaderboard', currentState.players);

                if (numOfWords > 0) {
                  // Reset scores for next word
                  currentState.cluesAnswered[uid] = [false, false];
                  for (const playerId of Object.keys(currentState.players)) {
                    currentState.score[playerId] = 100;
                    const playerSocketId = currentState.socketMap[playerId];
                    if (playerSocketId) {
                      io.to(playerSocketId).emit('clear_field_new_word');
                    }
                  }
                  await GameStateManager.updateRoom(roomId, currentState);
                  const adminSocketId = currentState.socketMap[currentState.admin];
                  if (adminSocketId) {
                    io.to(adminSocketId).emit("game_restart", { roomId, numOfWords, timePerQuestion });
                  }
                  socket.broadcast.to(roomId).emit("next_word_in");
                } else {
                  io.to(roomId).emit('end_game');
                }
              } catch (error) {
                console.error('Caught:', error);
              }
            }

        }, 1000);
    });
    

    socket.on('check_clue_answer', async ({ questionIndex, field, roomId }) => {
      const gameState = await GameStateManager.getRoom(roomId);
      const { uid } = socket.data.user;
      if (!gameState || !uid) return;

      // Assume a question is "correct" if both clues are answered
      if (field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase()) {
        socket.emit('check_clue1_answer', field.toLowerCase());
        gameState.cluesAnswered[uid][0] = true;
        await GameStateManager.updateRoom(roomId, gameState);
        console.log(`Player ${uid} answered clue1 correctly for question index ${questionIndex}`);
      } else if (field.toLowerCase() === gameState.data[questionIndex].answer2.toLowerCase()) {
        socket.emit('check_clue2_answer', field.toLowerCase());
        gameState.cluesAnswered[uid][1] = true;
        await GameStateManager.updateRoom(roomId, gameState);
        console.log(`Player ${uid} answered clue2 correctly for question index ${questionIndex}`);
      } else if (field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase() + gameState.data[questionIndex].answer2.toLowerCase()) {
        socket.emit('check_clue1_answer', gameState.data[questionIndex].answer1.toLowerCase());
        socket.emit('check_clue2_answer', gameState.data[questionIndex].answer2.toLowerCase());
        gameState.cluesAnswered[uid][0] = true;
        gameState.cluesAnswered[uid][1] = true;
        await GameStateManager.updateRoom(roomId, gameState);
      } else {
        socket.emit('check_clue1_answer', null);
      }

      console.log(gameState.cluesAnswered[uid][0], gameState.cluesAnswered[uid][1]);
      if (gameState.cluesAnswered[uid][0] && gameState.cluesAnswered[uid][1]) {
        gameState.players[uid].playerScore += gameState.score[uid];
        await GameStateManager.updateRoom(roomId, gameState);
        io.to(roomId).emit('update_leaderboard', gameState.players);
        console.log(`Player ${uid} answered correctly for question index ${questionIndex}`);
      }

      await GameStateManager.updateRoom(roomId, gameState);
    });


// MODIFIED: Enhanced cleanup function with reconnection grace period
async function cleanupPlayerDisconnect(socket, roomId, uid, nickname, isReload = false) {
  try {    
    const gameState = await GameStateManager.getRoom(roomId);
    if (!gameState) {
      console.log(`Room ${roomId} not found during cleanup`);
      return;
    }

    if (isReload) {
      console.log(`Setting reconnection grace period for ${nickname} in room ${roomId}`);
      
      if (gameState.socketMap && gameState.socketMap[uid]) {
        delete gameState.socketMap[uid];
        await GameStateManager.updateRoom(roomId, gameState);
        console.log(`Cleared socket mapping for ${nickname}`);
      }
      
      const timerKey = `${uid}_${roomId}`;
      if (playerReconnectionTimers.has(timerKey)) {
        clearTimeout(playerReconnectionTimers.get(timerKey));
      }
      
      const timer = setTimeout(async () => {
        console.log(`Grace period expired for ${nickname}, removing from room ${roomId}`);
        await actuallyRemovePlayer(roomId, uid, nickname);
        playerReconnectionTimers.delete(timerKey);
      }, RECONNECTION_GRACE_PERIOD);
      
      playerReconnectionTimers.set(timerKey, timer);
      socket.leave(roomId);
      return;
    }else{
      console.log('Not a reload, removing player immediately:', nickname);
      await actuallyRemovePlayer(roomId, uid, nickname);
      socket.leave(roomId);
    }
    
    
  } catch (error) {
    console.error(`Error cleaning up player ${uid} from room ${roomId}:`, error);
  }
}


// NEW: Actual player removal logic
async function actuallyRemovePlayer(roomId, uid, nickname) {
  const gameState = await GameStateManager.getRoom(roomId);
  if (!gameState) return;

  // Remove player from game state
  if (gameState.players[uid]) {
    delete gameState.players[uid];
    delete gameState.score[uid];
    delete gameState.cluesAnswered[uid];
    delete gameState.socketMap[uid];
  }

  // Check if room is now empty
  const remainingPlayers = Object.keys(gameState.players);
  console.log(`Remaining players in room ${roomId}:`, remainingPlayers.length);
  
  if (remainingPlayers.length === 0) {
    // No players left - delete the room entirely
    console.log(`Deleting empty room: ${roomId}`);
    await GameStateManager.deleteRoom(roomId);
    await redisClient.srem('public_rooms', roomId);
    
    // Clean up any pending invitations for this room
    const invitationKeys = await redisClient.keys(`game_invitation:*`);
    for (const key of invitationKeys) {
      const invitationData = await redisClient.get(key);
      if (invitationData) {
        const invitation = JSON.parse(invitationData);
        if (invitation.roomId === roomId) {
          await redisClient.del(key);
        }
      }
    }
  } else {
    console.log(`Player ${nickname} left room ${roomId}. ${remainingPlayers.length} players remaining.`);
    
    // If the disconnected player was admin, assign new admin
    if (gameState.admin === uid) {
      const newAdmin = remainingPlayers[0];
      gameState.admin = newAdmin;
      console.log(`New admin for room ${roomId}: ${newAdmin}`);
      
      const newAdminSocketId = gameState.socketMap[newAdmin];
      if (newAdminSocketId) {
        io.to(newAdminSocketId).emit('became_admin', {
          uid: newAdmin,
          nickname: gameState.players[newAdmin]?.nickname || "Unknown"
        });
        io.to(roomId).emit('admin_changed', {
          uid: newAdmin,
          nickname: gameState.players[newAdmin]?.nickname || "Unknown"
        });
      }
    }
    
    // Update Redis with new state
    await GameStateManager.updateRoom(roomId, gameState);
    
    // Notify remaining players
    io.to(roomId).emit('update_leaderboard', gameState.players);
    io.to(roomId).emit('player_disconnected', {
      uid,
      nickname,
      remainingPlayers: remainingPlayers.length
    });
  }
}





// Replace the disconnect handler with this:
socket.on('disconnecting', async (reason) => {
    const { uid, nickname } = socket.data.user || {};
    if (!uid) {
      return;
    }

    // Detect if this is likely a page reload vs tab close
    const isReload = reason === 'transport close' || reason === 'client namespace disconnect';
    if(isReload){
      console.log(`Detected page reload for ${nickname} (${uid})`);
    }
    const currentRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    
    for (const roomId of currentRooms) {
      await cleanupPlayerDisconnect(socket, roomId, uid, nickname, isReload);
    }
});

// Keep this for logging (optional)
socket.on('disconnect', () => {
  // console.log('Client fully disconnected');
});


});

// TODO: Use react router to have shareable links for rooms
server.listen(PORT, '0.0.0.0', () => {
  console.log(`server running at http://localhost:${PORT}`);
});


