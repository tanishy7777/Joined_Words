import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import cors from 'cors';

import { dirname } from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;

import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data.json', 'utf-8'));

import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();


await Promise.all([redisClient.connect(), pubClient.connect(), subClient.connect()]);


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
  
    socket.on('create_room', async (callback) => {
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 10);
        } while (await GameStateManager.getRoom(roomId));

        const initialState = {
            questionIndex: 0,
            timer: null,
            score: {},  // this score is displayed on the screen
            data: data,
            players: {},
            admin: socket.id,
            totalWords: null,
            cluesAnswered: {},
            isPrivateGame: true,
            numOfWords: 3,
            timePerQuestion: 1,
        };

        initialState.players[socket.id] = { playerScore: 0 };
        initialState.score[socket.id] = 100;
        initialState.cluesAnswered[socket.id] = [false, false];
        
        if (!initialState.isPrivateGame) {
            await redisClient.sAdd('public_rooms', roomId);
        }

        await GameStateManager.createRoom(roomId, initialState);
        socket.join(roomId);
        console.log('room created:', roomId);
        io.to(roomId).emit('update_leaderboard', initialState.players);
        callback(roomId);
    });

    socket.on('join_random_room', async (callback) => {
      // Get public rooms from Redis Set
        const publicRoomIds = await redisClient.sMembers('public_rooms');
        
        // Filter available rooms
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

        // Initialize player state
        currentState.players[socket.id] = { playerScore: 0 };
        currentState.score[socket.id] = 100;
        currentState.cluesAnswered[socket.id] = [false, false];

        await GameStateManager.updateRoom(randomRoom, currentState);
        socket.join(randomRoom);
        io.to(randomRoom).emit('update_leaderboard', currentState.players);
        callback({ success: true, roomId: randomRoom });
    });


    socket.on('join_room', async (roomId, callback) => {
        // const currentState = gameStates[roomId];  
        const currentState = await GameStateManager.getRoom(roomId);      
        if (!currentState) {
            console.log('Room not found:', roomId);
            if (typeof callback === 'function') {
                callback({ success: false, reason: 'ROOM_NOT_FOUND' });
            }
            return;
        }
        
        // 1. Initialize player state
        currentState.players[socket.id] = { playerScore: 0 };
        currentState.score[socket.id] = 100;
        currentState.cluesAnswered[socket.id] = [false, false];

        // 2. Update Redis
        await GameStateManager.updateRoom(roomId, currentState);

        socket.join(roomId);
        console.log('Room joined:', roomId, 'Socket ID:', socket.id);
        
        // 3. Update all clients
        io.to(roomId).emit('update_leaderboard', currentState.players);
        
        // 4. Send success response
        if (typeof callback === 'function') {
            callback({ success: true });
        }
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



    socket.on('start_game', async (roomId, isLoop)  => {

      const gameState = await GameStateManager.getRoom(roomId);
      if (!gameState) return;

      // Destructure ALL config values with defaults
      let { 
          numOfWords = 3,
          timePerQuestion = 1,
          isPrivateGame = false
      } = gameState;

      console.log(`Starting game with config:`, {
          numOfWords,
          timePerQuestion,
          isPrivateGame
      });

      // Your existing game start logic using these values...
      if(!isLoop) {
          io.to(roomId).emit('load_game_component');
          gameState.totalWords = numOfWords;
          await GameStateManager.updateRoom(roomId, gameState);
      }

      console.log(`Game started in room: ${roomId}`);
      console.log('Number of words:', numOfWords, 'Time per question:', timePerQuestion, 'Is Private Game:', isPrivateGame, 'Is Loop:', isLoop);
      const questionData = {
        questionIndex: gameState.totalWords - numOfWords,
        clue1: gameState.data[gameState.totalWords - numOfWords].clue1,
        clue2: gameState.data[gameState.totalWords - numOfWords].clue2,
        jwclue: gameState.data[gameState.totalWords - numOfWords].jwclue,
      };

      gameState.questionIndex = gameState.totalWords - numOfWords;
      numOfWords--; 
      // let totalTime = timePerQuestion*60;
      let totalTime = 16;
      let countdownTime = totalTime; 
      let gameInterval;
      let timePenalty = 10;
      
      
      console.log(roomId);
      console.log(socket.id);
      console.log(socket.rooms); // It should list all the rooms the socket is connected to
      
      // io.to(roomId).emit('get_question_data', questionData);
      // Added this delay to ensure that the client has loaded the game component
      setTimeout(() => {
        io.to(roomId).emit('get_question_data', questionData);
        io.to(roomId).emit('get_score', gameState.score[socket.id]); // Added this from join_room and reset after each loop
      }, 10);  
      
      io.to(roomId).emit('game_started', countdownTime);

      gameInterval = setInterval(async () => {
          countdownTime--;
          io.to(roomId).emit('update_timer', countdownTime);

          if ((totalTime - countdownTime) % 5 === 0) {
              for (const playerId of Object.keys(gameState.players)) {
                  if (!(JSON.stringify(gameState.cluesAnswered[playerId]) === JSON.stringify([true, true]))) {
                      gameState.score[playerId] -= timePenalty;
                      io.to(playerId).emit('score_update', gameState.score[playerId]);
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
                      io.to(playerId).emit('clear_field_new_word');
                  }
                  await GameStateManager.updateRoom(roomId, gameState);
                  io.to(gameState.admin).emit("game_restart", {roomId, numOfWords, timePerQuestion});
                  socket.broadcast.to(roomId).emit("next_word_in");
              } else {
                  io.to(roomId).emit('end_game');
              }
          }
      }, 1000);
    });
    

    socket.on('check_clue_answer', async ({questionIndex, field, roomId}) => {
      console.log('Checking clue answer', questionIndex, field);
      const gameState = await GameStateManager.getRoom(roomId);
      if(roomId){
        if(field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase()){
          socket.emit('check_clue1_answer', field.toLowerCase());
          gameState.cluesAnswered[socket.id][0] = true;
        }else if(field.toLowerCase() === gameState.data[questionIndex].answer2.toLowerCase()){
          socket.emit('check_clue2_answer', field.toLowerCase());
          gameState.cluesAnswered[socket.id][1] = true;
        }else if(field.toLowerCase() === gameState.data[questionIndex].answer1.toLowerCase() + gameState.data[questionIndex].answer2.toLowerCase()){
          socket.emit('check_clue1_answer', gameState.data[questionIndex].answer1.toLowerCase());
          socket.emit('check_clue2_answer', gameState.data[questionIndex].answer2.toLowerCase());
          gameState.cluesAnswered[socket.id][0] = true;
          gameState.cluesAnswered[socket.id][1] = true;
        }
        else{
          socket.emit('check_clue1_answer', null);
        }
      }
      await GameStateManager.updateRoom(roomId, gameState);
      
    });

    // TODO: Use react router to have shareable links for rooms
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`server running at http://localhost:${PORT}`);
});


