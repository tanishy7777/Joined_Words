import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import cors from 'cors';
import { getFirestore } from 'firebase-admin/firestore';
import { dirname } from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;

import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data.json', 'utf-8'));

import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';


// Redis setup
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();


await Promise.all([redisClient.connect(), pubClient.connect(), subClient.connect()]);


// Authentication and Firebase Admin SDK setup
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./jwmultiplayer-firebase-adminsdk-2952g-1bfce059ed.json');


// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// User authentication mapping
// let authenticatedUsers = new Map(); // socket.id -> firebaseUID mapping


const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        // origin: "http://35.207.196.68:5173",
        origin: "http://localhost:5173", 
        methods: ["GET", "POST"],       
        credentials: true, 
    },
    adapter: createAdapter(pubClient, subClient)
});


app.use(cors({
    origin: "http://localhost:5173",
    // origin: "http://35.207.196.68:5173",
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
  socket.data.user = { uid, nickname };          // ⬅️ CHANGED: assign without verify
  next();
});


// Game State Management with Redis
class GameStateManager {
    static async createRoom(roomId, initialState) {
      try{
        const key = `gamestate:${roomId}`;
        await redisClient.setEx(key, 3600, JSON.stringify(initialState)); // 1 hour expiry
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
        return state ? JSON.parse(state) : null;
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
          await redisClient.setEx(`gamestate:${roomId}`, 3600, JSON.stringify(updatedState));
          return updatedState;
      } catch (error) {
          console.error('Redis update failed:', error);
          return null;
      }
  }

    static async deleteRoom(roomId) {
        try {
          console.log(`Deleting room: ${roomId}`);
          await redisClient.del(`gamestate:${roomId}`);
        } catch (error) {
          console.error('Redis delete failed:', error);
        }
    }
}

// Periodic cleanup of public_rooms set (remove non-existent rooms)
// CHANGE: Interval now every 10 minutes (was 100 minutes)
setInterval(async () => {
    const publicRooms = await redisClient.sMembers('public_rooms');
    for (const roomId of publicRooms) {
        if (!(await redisClient.exists(`gamestate:${roomId}`))) {
            await redisClient.sRem('public_rooms', roomId);
        }
    }
}, 10 * 60 * 1000); // Every 10 minutes

io.on('connection',  (socket) => {
  console.log('New client connected'); 

    // Set up the socket data with user info
    socket.on('get_room_info', async (roomId, callback) => {
      const gameState = await GameStateManager.getRoom(roomId);
      const { uid } = socket.data.user;
      if (!gameState || !uid) {
        return callback({ error: true });
      }
      const isAdmin = gameState.admin === uid;
      const gameStarted = gameState.totalWords !== null;
      callback({ isAdmin, gameStarted });
    });



    // // Authenticate user
    // socket.on('authenticate', async (authData) => {
    //     try {
    //         const { uid, nickname } = authData;
    //         authenticatedUsers.set(socket.id, { uid, nickname });
    //         socket.emit('authenticated', { success: true });
    //         console.log(`User authenticated: ${nickname} (${uid})`);
    //     } catch (error) {
    //         console.error('Authentication failed:', error);
    //         socket.emit('authentication_error', 'Authentication failed');
    //     }
    // });
  
    socket.on('create_room', async (callback) => {
        const { uid, nickname } = socket.data.user;              // ⬅️ CHANGED
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
            await redisClient.sAdd('public_rooms', roomId);
        }

        await GameStateManager.createRoom(roomId, initialState);
        socket.join(roomId);
        io.to(roomId).emit('update_leaderboard', initialState.players);
        callback({ success: true, roomId });
    });

    // FIXED: Join random room handler
    socket.on('join_random_room', async (callback) => {
        const { uid, nickname } = socket.data.user;                // ⬅️ CHANGED
        if (!uid) {
          return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
        }

        const publicRoomIds = await redisClient.sMembers('public_rooms');
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
        const { uid, nickname } = socket.data.user;             // ⬅️ CHANGED
        if (!uid) {
          return callback({ success: false, reason: 'NOT_AUTHENTICATED' });
        }

        const currentState = await GameStateManager.getRoom(roomId);      
        if (!currentState) {
            console.log('Room not found:', roomId);
            if (typeof callback === 'function') {
                callback({ success: false, reason: 'ROOM_NOT_FOUND' });
            }
            return;
        }
        
        // 1. Initialize player state
        // Initialize player with Firebase UID
        currentState.players[uid] = { 
          playerScore: 0, 
          nickname: nickname,
          socketId: socket.id 
        };
        currentState.score[uid] = 100;
        currentState.cluesAnswered[uid] = [false, false];
        currentState.socketMap[uid] = socket.id;

        // 2. Update Redis
        await GameStateManager.updateRoom(roomId, currentState);
        socket.join(roomId);
        console.log('Room joined:', roomId, 'Socket ID:', socket.id);
        
        // 3. Update all clients
        io.to(roomId).emit('update_leaderboard', currentState.players);
        
        callback?.({ success: true });
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
                await redisClient.sRem('public_rooms', roomId);
            } else {
                await redisClient.sAdd('public_rooms', roomId);
            }
        }
        // Update Redis with the new game state
        await GameStateManager.updateRoom(roomId, gameState);
      }
});



    socket.on('start_game', async (roomId, isLoop) => {
        const gameState = await GameStateManager.getRoom(roomId);
        if (!gameState) return;

        const { uid } = socket.data.user;
        if (!uid) return;

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
        let totalTime = 16;
        let countdownTime = totalTime;
        let timePenalty = 10;

        setTimeout(() => {
            io.to(roomId).emit('get_question_data', questionData);
            // FIXED: Use Firebase UID
            io.to(roomId).emit('get_score', gameState.score[uid]);
        }, 10);

        io.to(roomId).emit('game_started', countdownTime);

        const gameInterval = setInterval(async () => {
            countdownTime--;
            io.to(roomId).emit('update_timer', countdownTime);

            if ((totalTime - countdownTime) % 5 === 0) {
                for (const playerId of Object.keys(gameState.players)) {
                    if (!(JSON.stringify(gameState.cluesAnswered[playerId]) === JSON.stringify([true, true]))) {
                        gameState.score[playerId] -= timePenalty;
                        // FIXED: Use socketMap to get correct socket ID
                        const playerSocketId = gameState.socketMap[playerId];
                        if (playerSocketId) {
                            io.to(playerSocketId).emit('score_update', gameState.score[playerId]);
                        }
                    }
                }
                await GameStateManager.updateRoom(roomId, gameState);
            }

            if (countdownTime <= 0) {
                clearInterval(gameInterval);
                for (const playerId of Object.keys(gameState.players)) {
                    gameState.players[playerId].playerScore += gameState.score[playerId];
                }
                await GameStateManager.updateRoom(roomId, gameState);
                io.to(roomId).emit('update_leaderboard', gameState.players);

                if (numOfWords > 0) {
                    for (const playerId of Object.keys(gameState.players)) {
                        gameState.score[playerId] = 100;
                        const playerSocketId = gameState.socketMap[playerId];
                        if (playerSocketId) {
                            io.to(playerSocketId).emit('clear_field_new_word');
                        }
                    }
                    await GameStateManager.updateRoom(roomId, gameState);
                    const adminSocketId = gameState.socketMap[gameState.admin];
                    if (adminSocketId) {
                        io.to(adminSocketId).emit("game_restart", { roomId, numOfWords, timePerQuestion });
                    }
                    socket.broadcast.to(roomId).emit("next_word_in");
                } else {
                    io.to(roomId).emit('end_game');
                }
            }
        }, 1000);
    });
    

    socket.on('check_clue_answer', async ({ questionIndex, field, roomId }) => {
        const gameState = await GameStateManager.getRoom(roomId);
        const { uid } = socket.data.user;  
        if (!gameState || !uid) return;

        if (field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase()) {
            socket.emit('check_clue1_answer', field.toLowerCase());
            gameState.cluesAnswered[uid][0] = true;
        } else if (field.toLowerCase() === gameState.data[questionIndex].answer2.toLowerCase()) {
            socket.emit('check_clue2_answer', field.toLowerCase());
            gameState.cluesAnswered[uid][1] = true;
        } else if (field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase() + gameState.data[questionIndex].answer2.toLowerCase()) {
            socket.emit('check_clue1_answer', gameState.data[questionIndex].answer1.toLowerCase());
            socket.emit('check_clue2_answer', gameState.data[questionIndex].answer2.toLowerCase());
            gameState.cluesAnswered[uid][0] = true;
            gameState.cluesAnswered[uid][1] = true;
        } else {
            socket.emit('check_clue1_answer', null);
        }
        await GameStateManager.updateRoom(roomId, gameState);
    });


    // Friend system handlers
  socket.on('send_friend_request', async (data, callback) => {
    const { uid, nickname } = socket.data.user; // ⬅️ Use socket.data.user for auth
    if (!uid) { return callback({ success: false, reason: 'NOT_AUTHENTICATED' }); }
    try {
      const { targetUserUid } = data;
      const requestId = `${uid}_${targetUserUid}_${Date.now()}`; // ⬅️ Use uid for request ID
      await redisClient.setEx(`friend_request:${requestId}`, 3600, JSON.stringify({
        id: requestId, senderUid: uid, senderNickname: nickname, targetUserUid, status: 'pending', createdAt: new Date()
      }));
      await redisClient.sAdd(`user_sent_requests:${uid}`, requestId);
      await redisClient.sAdd(`user_received_requests:${targetUserUid}`, requestId);
      let targetSocketId = null;
      for (const [id, s] of io.sockets.sockets) { // ⬅️ Find target socket by UID
        if (s.data.user?.uid === targetUserUid) { targetSocketId = id; break; }
      }
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend_request_received', { id: requestId, senderUid: uid, senderNickname: nickname });
      }
      callback({ success: true });
    } catch (error) {
      console.error('Error sending friend request:', error);
      callback({ success: false, reason: 'SERVER_ERROR' });
    }
  });

  socket.on('respond_friend_request', async (data, callback) => {
    const { uid } = socket.data.user; // ⬅️ Use socket.data.user for auth
    if (!uid) { return callback({ success: false, reason: 'NOT_AUTHENTICATED' }); }
    try {
      const { requestId, response } = data;
      const requestData = await redisClient.get(`friend_request:${requestId}`);
      if (!requestData) { callback({ success: false, reason: 'REQUEST_NOT_FOUND' }); return; }
      const request = JSON.parse(requestData);
      if (request.targetUserUid !== uid) { callback({ success: false, reason: 'UNAUTHORIZED' }); return; }
      if (response === 'accepted') {
        await redisClient.sAdd(`user_friends:${request.senderUid}`, uid);
        await redisClient.sAdd(`user_friends:${uid}`, request.senderUid);
      }
      await redisClient.del(`friend_request:${requestId}`);
      await redisClient.sRem(`user_sent_requests:${request.senderUid}`, requestId);
      await redisClient.sRem(`user_received_requests:${uid}`, requestId);
      callback({ success: true });
    } catch (error) {
      console.error('Error responding to friend request:', error);
      callback({ success: false, reason: 'SERVER_ERROR' });
    }
  });

  
  const firestore = getFirestore();

  // Enhanced get_friends handler with game status
  socket.on('get_friends', async (callback) => {
    const { uid } = socket.data.user;
    if (!uid) return callback([]);

    try {
      const friendUids = await redisClient.sMembers(`user_friends:${uid}`);
      const friends = [];
      
      for (const friendUid of friendUids) {
        let isOnline = false;
        let nickname = null;
        let gameStatus = 'offline'; // offline, online, in_game
        let currentRoom = null;
        
        // Check if friend is online
        for (const [id, s] of io.sockets.sockets) {
          if (s.data.user?.uid === friendUid) {
            isOnline = true;
            nickname = s.data.user.nickname;
            
            // Check if friend is in a game room
            const friendRooms = Array.from(s.rooms).filter(room => room !== s.id);
            if (friendRooms.length > 0) {
              gameStatus = 'in_game';
              currentRoom = friendRooms[0];
            } else {
              gameStatus = 'online';
            }
            break;
          }
        }
        
        if (!isOnline) {
          // Fetch nickname from Firestore for offline friends
          const userDoc = await firestore.doc(`users/${friendUid}`).get();
          nickname = userDoc.exists ? userDoc.data().nickname : 'Unknown';
          gameStatus = 'offline';
        }
        
        friends.push({ 
          uid: friendUid, 
          nickname, 
          isOnline, 
          gameStatus,
          currentRoom 
        });
      }
      
      callback(friends);
    } catch (error) {
      console.error('Error getting friends:', error);
      callback([]);
    }
  });


  socket.on('get_friend_requests', async (callback) => {
    const { uid } = socket.data.user; // ⬅️ Use socket.data.user for auth
    if (!uid) return;
    try {
      const requestIds = await redisClient.sMembers(`user_received_requests:${uid}`);
      const requests = [];
      for (const requestId of requestIds) {
        const requestData = await redisClient.get(`friend_request:${requestId}`);
        if (requestData) { requests.push(JSON.parse(requestData)); }
      }
      callback(requests);
    } catch (error) {
      console.error('Error getting friend requests:', error);
      callback([]);
    }
  });

  // Add to server.js - Enhanced invite system
socket.on('invite_friend_to_game', async (data, callback) => {
  const { uid, nickname } = socket.data.user;
  if (!uid) { 
    callback({ success: false, reason: 'NOT_AUTHENTICATED' }); 
    return; 
  }

  try {
    const { friendUid } = data;
    
    // Check if sender is in a game room
    const senderRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    if (senderRooms.length === 0) {
      callback({ success: false, reason: 'NOT_IN_GAME' });
      return;
    }
    
    const currentRoomId = senderRooms[0];
    const gameState = await GameStateManager.getRoom(currentRoomId);
    
    if (!gameState) {
      callback({ success: false, reason: 'INVALID_ROOM' });
      return;
    }

    // Find target user's socket
    let targetSocketId = null;
    for (const [id, s] of io.sockets.sockets) {
      if (s.data.user?.uid === friendUid) { 
        targetSocketId = id; 
        break; 
      }
    }

    if (targetSocketId) {
      const invitationId = `${uid}_${friendUid}_${Date.now()}`;
      
      // Store invitation temporarily
      await redisClient.setEx(
        `game_invitation:${invitationId}`, 
        300, // 5 minutes expiry
        JSON.stringify({
          invitationId,
          senderUid: uid,
          senderNickname: nickname,
          targetUid: friendUid,
          roomId: currentRoomId,
          createdAt: new Date()
        })
      );

      console.log('Sending invite to socket:', targetSocketId); 
      io.to(targetSocketId).emit('friend_invitation_received', {
        invitationId,
        senderUid: uid,
        senderNickname: nickname,
        roomId: currentRoomId
      });
      
      callback({ success: true });
    } else {
      callback({ success: false, reason: 'FRIEND_OFFLINE' });
    }
  } catch (error) {
    console.error('Error inviting friend:', error);
    callback({ success: false, reason: 'SERVER_ERROR' });
  }
});

// Handle invitation acceptance
socket.on('accept_game_invitation', async (data, callback) => {
  console.log('Accepting game invitation:', data);
  const { uid, nickname } = socket.data.user;
  if (!uid) {
    callback({ success: false, reason: 'NOT_AUTHENTICATED' });
    return;
  }

  try {
    const { invitationId } = data;
    
    // Get invitation details
    const invitationData = await redisClient.get(`game_invitation:${invitationId}`);
    if (!invitationData) {
      callback({ success: false, reason: 'INVITATION_EXPIRED' });
      return;
    }

    const invitation = JSON.parse(invitationData);
    
    if (invitation.targetUid !== uid) {
      callback({ success: false, reason: 'UNAUTHORIZED' });
      return;
    }

    // Check if target is currently in another room
    const currentRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    
    if (currentRooms.length > 0) {
      // Leave current room and clean up
      for (const roomId of currentRooms) {
        await cleanupPlayerFromRoom(socket, roomId, uid);
      }
    }

    // Join the invited room
    const targetRoomId = invitation.roomId;
    const targetGameState = await GameStateManager.getRoom(targetRoomId);
    
    if (!targetGameState) {
      callback({ success: false, reason: 'ROOM_NO_LONGER_EXISTS' });
      await redisClient.del(`game_invitation:${invitationId}`);
      return;
    }

    // Add player to new room
    targetGameState.players[uid] = {
      playerScore: 0,
      nickname: nickname,
      socketId: socket.id
    };
    targetGameState.score[uid] = 100;
    targetGameState.cluesAnswered[uid] = [false, false];
    targetGameState.socketMap[uid] = socket.id;

    await GameStateManager.updateRoom(targetRoomId, targetGameState);
    socket.join(targetRoomId);
    
    // Update all clients in the room
    io.to(targetRoomId).emit('update_leaderboard', targetGameState.players);
    io.to(targetRoomId).emit('player_joined', { uid, nickname });

    // Clean up invitation
    await redisClient.del(`game_invitation:${invitationId}`);
    
    callback({ success: true, roomId: targetRoomId });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    callback({ success: false, reason: 'SERVER_ERROR' });
  }
});

// Helper function to clean up player from room
async function cleanupPlayerFromRoom(socket, roomId, uid) {
  const gameState = await GameStateManager.getRoom(roomId);
  if (gameState && gameState.players[uid]) {
    delete gameState.players[uid];
    delete gameState.score[uid];
    delete gameState.cluesAnswered[uid];
    delete gameState.socketMap[uid];
    
    await GameStateManager.updateRoom(roomId, gameState);
    socket.leave(roomId);
    
    // Notify remaining players
    io.to(roomId).emit('update_leaderboard', gameState.players);
    io.to(roomId).emit('player_left', { uid });
  }
}


  socket.on('disconnect', () => { console.log('Client disconnected'); }); // ⬅️ No need to delete from authenticatedUsers
});

    // TODO: Use react router to have shareable links for rooms



server.listen(PORT, '0.0.0.0', () => {
  console.log(`server running at http://localhost:${PORT}`);
});


