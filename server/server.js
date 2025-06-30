import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import cors from 'cors';

import { dirname } from "path";
import { fileURLToPath } from "url";

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const PORT = process.env.PORT || 3000;

import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data.json', 'utf-8'));


// Redis Setup
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

await Promise.all([
    redisClient.connect(),
    pubClient.connect(),
    subClient.connect()
]);

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
        const key = `gamestate:${roomId}`;
        await redisClient.setEx(key, 3600, JSON.stringify(initialState)); // 1 hour expiry
        return roomId;
    }

    static async getRoom(roomId) {
        const key = `gamestate:${roomId}`;
        const state = await redisClient.get(key);
        return state ? JSON.parse(state) : null;
    }

    static async updateRoom(roomId, updates) {
        const currentState = await this.getRoom(roomId);
        if (currentState) {
            const updatedState = { ...currentState, ...updates };
            await redisClient.setEx(`gamestate:${roomId}`, 3600, JSON.stringify(updatedState));
            return updatedState;
        }
        return null;
    }

    static async deleteRoom(roomId) {
        await redisClient.del(`gamestate:${roomId}`);
    }
}

let gameStates = {};
io.on('connection',  (socket) => {
  console.log('New client connected'); 
  
    let rooms = new Set();
    const publicRooms = new Set();
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

        await GameStateManager.createRoom(roomId, initialState);
        socket.join(roomId);
        console.log('room created:', roomId);
        io.to(roomId).emit('update_leaderboard', initialState.players);
        rooms.add(roomId);
        publicRooms.add(roomId);
        callback(roomId);
    });

  
    socket.on('join_random_room', (callback) => {
        const availableRooms = [];
        
        for (const [roomId, state] of Object.entries(gameStates)) {
            if (!state.isPrivateGame && state.totalWords === null) {
                availableRooms.push(roomId);
            }
        }
        
        if (availableRooms.length === 0) {
            callback({ success: false, reason: 'NO_PUBLIC_ROOMS' });
            return;
        }
        
        const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
        socket.join(randomRoom);
        
        // Initialize player state
        const currentState = gameStates[randomRoom];
        currentState.players[socket.id] = { playerScore: 0 };
        currentState.score[socket.id] = 100;
        currentState.cluesAnswered[socket.id] = [false, false];
        
        // Update clients
        io.to(randomRoom).emit('update_leaderboard', currentState.players);
        
        callback({ success: true, roomId: randomRoom });
    });


    socket.on('join_room', (roomId, callback) => {
        const currentState = gameStates[roomId];        
        if (!currentState) {
            console.log('Room not found:', roomId);
            if (typeof callback === 'function') {
                callback({ success: false, reason: 'ROOM_NOT_FOUND' });
            }
            return;
        }
        // 4. Allow joining
        socket.join(roomId);
        console.log('Room joined:', roomId, 'Socket ID:', socket.id);
        
        // 5. Initialize player state
        currentState.players[socket.id] = { playerScore: 0 };
        currentState.score[socket.id] = 100;
        currentState.cluesAnswered[socket.id] = [false, false];
        
        // 6. Update all clients
        io.to(roomId).emit('update_leaderboard', currentState.players);
        
        // 7. Send success response
        if (typeof callback === 'function') {
            callback({ success: true });
        }
    });
    

    socket.on('get_leaderboard', (roomId) => {
      const currentState = gameStates[roomId];
      if (currentState) {
          io.to(roomId).emit('update_leaderboard', currentState.players);
      }
   });

    socket.on('update_config', (roomId, config) => {
      const gameState = gameStates[roomId];
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
                  publicRooms.delete(roomId);
              } else {
                  publicRooms.add(roomId);
              }
          }
      }
});



    socket.on('start_game', (roomId, isLoop)  => {

      const gameState = gameStates[roomId];
      if (!gameState) return;

      // Destructure ALL config values with defaults
      const { 
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
      }

      console.log(`Game started in room: ${roomId}`);
      console.log('Number of words:', numOfWords, 'Time per question:', timePerQuestion, 'Is Private Game:', isPrivateGame, 'Is Loop:', isLoop);
      const questionData = {
        questionIndex: gameStates[roomId].totalWords - numOfWords,
        clue1: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].clue1,
        clue2: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].clue2,
        jwclue: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].jwclue,
      };

      gameStates[roomId].questionIndex = gameStates[roomId].totalWords - numOfWords;
      
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
        io.to(roomId).emit('get_score', gameStates[roomId].score[socket.id]); // Added this from join_room and reset after each loop
      }, 10);  
      
      io.to(roomId).emit('game_started', countdownTime);
      
      gameInterval = setInterval(() => {
        countdownTime--;
        if((totalTime - countdownTime)%5==0){
          // TODO: No time penalty if answered both clues
          Object.keys(gameStates[roomId].players).forEach(playerId => {
            if(!(JSON.stringify(gameStates[roomId].cluesAnswered[playerId]) === JSON.stringify([true, true]))){
              gameStates[roomId].score[playerId] -= timePenalty;
              io.to(playerId).emit('score_update', gameStates[roomId].score[socket.id]);
            }            
          });
          
        }
        
        console.log(countdownTime);
        io.to(roomId).emit('update_timer', countdownTime);
        
        if (countdownTime <= 0) {
          clearInterval(gameInterval);
          
          const currentState = gameStates[roomId];
          if (currentState && currentState.players[socket.id]) {
            Object.keys(currentState.players).forEach(playerId => {
              currentState.players[playerId].playerScore += currentState.score[playerId];
              console.log("Updating Leaderboard for", playerId, currentState.score[socket.id]);
            });
            io.to(roomId).emit('update_leaderboard', currentState.players);
            console.log("Updating Leaderboard", currentState.players);
          }
          
          if(numOfWords > 0){       
            // reset max_score
            Object.keys(gameStates[roomId].players).forEach(playerId => {
              gameStates[roomId].score[playerId] = 100;
              io.to(playerId).emit('clear_field_new_word')
            });
            
            io.to(gameStates[roomId].admin).emit("game_restart", {roomId, numOfWords, timePerQuestion});
            socket.broadcast.to(roomId).emit("next_word_in");
            console.log("Next word in");
          }else{
            io.to(roomId).emit('end_game');
          }
        }
        
      }, 1000);
    });
    

    socket.on('check_clue_answer', ({questionIndex, field, roomId}) => {
      console.log('Checking clue answer', questionIndex, field);
      console.log(gameStates[roomId], roomId, gameStates);
      if(roomId){
        if(field.toLowerCase() === gameStates[roomId].data[questionIndex].answer1.toLowerCase()){
          socket.emit('check_clue1_answer', field.toLowerCase());
          gameStates[roomId].cluesAnswered[socket.id][0] = true;
        }else if(field.toLowerCase() === gameStates[roomId].data[questionIndex].answer2.toLowerCase()){
          socket.emit('check_clue2_answer', field.toLowerCase());
          gameStates[roomId].cluesAnswered[socket.id][1] = true;
        }else if(field.toLowerCase() === gameStates[roomId].data[questionIndex].answer1.toLowerCase() + gameStates[roomId].data[questionIndex].answer2.toLowerCase()){
          socket.emit('check_clue1_answer', gameStates[roomId].data[questionIndex].answer1.toLowerCase());
          socket.emit('check_clue2_answer', gameStates[roomId].data[questionIndex].answer2.toLowerCase());
          gameStates[roomId].cluesAnswered[socket.id][0] = true;
          gameStates[roomId].cluesAnswered[socket.id][1] = true;
        }
        else{
          socket.emit('check_clue1_answer', null);
        }
      }
      
    });

    // TODO: Use react router to have shareable links for rooms



});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`server running at http://localhost:${PORT}`);
});


