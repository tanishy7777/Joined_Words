
import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import cors from 'cors';

import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data.json', 'utf-8'));

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
    res.sendFile(join(__dirname, 'index.html'));
});

let gameStates = {};
io.on('connection',  (socket) => {
    console.log('New client connected'); 

    socket.on('create_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room created:', roomId);
        gameStates[roomId] = {
          timer: null,
          score: 100,
          hintsAvailable: 0,
          data: data,
          players: {}
        };

        // add admin to players 
        gameStates[roomId].players[socket.id] = { playerScoreForCurrentWord: 0 }; // TODO: dynamically update based on correct answer
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players);

        // Get the question data from the state
        const currentState = gameStates[roomId];
        if (currentState) {
            const questionData = {
                clue1: currentState.data[0].clue1,
                clue2: currentState.data[0].clue2,
                jwclue: currentState.data[0].jwclue,
            };

            // Emit the data to the room, including the creator
            io.to(roomId).emit('get_question_data', questionData);
            console.log('Question data sent to room:', roomId, questionData);
        }

        // questionData = {
        //   clue1: currentState.data[0].clue1,
        //   clue2: currentState.data[0].clue2,
        //   jwclue: currentState.data[0].jwclue,
        // }
        // socket.to(roomId).emit('get_question_data', questionData);
    });

    socket.on('join_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room joined:', roomId);
        const currentState = gameStates[roomId];
        // console.log("state: ",currentState, gameStates)
        if (currentState) {
            io.to(roomId).emit('get_score', currentState.score);
            io.to(roomId).emit('get_hints_available', currentState.hintsAvailable);

            currentState.players[socket.id] = { playerScoreForCurrentWord: 0 }; // TODO: dynamically update based on correct answer

            const questionData = {
                clue1: currentState.data[0].clue1,
                clue2: currentState.data[0].clue2,
                jwclue: currentState.data[0].jwclue,
            }
            io.to(roomId).emit('get_question_data', questionData);
            io.to(roomId).emit('update_leaderboard', currentState.players);

            console.log('done')
        }
    });

    socket.on('get_leaderboard', (roomId) => {
      const currentState = gameStates[roomId];
      if (currentState) {
          io.to(roomId).emit('update_leaderboard', currentState.players);
      }
   });

    // socket.on('start_game', roomId => {
    //     console.log('Starting game');
    //     io.to(roomId).emit('game_started');
    //     // start timer
    // });

    socket.on('start_game', (roomId, numOfWords, timePerQuestion)  => {
        console.log(`Game started in room: ${roomId}`);
        // TODO: fetch question, hint, clues from db
        console.log('Number of words:', numOfWords, 'Time per question:', timePerQuestion);
        numOfWords--; 
        // let totalTime = timePerQuestion*60;
        let totalTime = 3;
        let countdownTime = totalTime; 
        let gameInterval;
        let startTime;
        let timePenalty = 10;
        let initialScore = 100;
        let remainingScore = initialScore;
        let hintsAvailable = 0;

        startTime = Date.now();
        console.log(roomId);
        console.log(socket.id);
        console.log(socket.rooms); // It should list all the rooms the socket is connected to

        io.to(roomId).emit('game_started', countdownTime);
        io.to(roomId).emit('get_score', remainingScore)
    
        // Start the countdown timer
        gameInterval = setInterval(() => {
          countdownTime--;
          if((totalTime - countdownTime)%15==0){
            remainingScore-=timePenalty;
            hintsAvailable+=1;
            gameStates[roomId].score = remainingScore;
            gameStates[roomId].hintsAvailable = hintsAvailable;
            io.to(roomId).emit('score_update_time_penalty', remainingScore);
            io.to(roomId).emit('unlock_hint', hintsAvailable);
          }

          console.log(countdownTime);
          io.to(roomId).emit('update_timer', countdownTime);

          if (countdownTime <= 0) {
            clearInterval(gameInterval);
            
            const currentState = gameStates[roomId];
            if (currentState && currentState.players[socket.id]) {
              currentState.players[socket.id].playerScoreForCurrentWord += currentState.score;
              io.to(roomId).emit('update_leaderboard', currentState.players);
              console.log("Updating Leaderboard", currentState.players);
            }

            if(numOfWords > 0){
              // wait for 10 seconds before starting the next word
              
              io.to(roomId).emit("game_restart", {roomId, numOfWords, timePerQuestion});
            }else{
              io.to(roomId).emit('end_game');
            }
          }

        }, 1000);
      });
    
    socket.on('check_clue1_answer', () => {
      console.log('Checking clue 1 answer');
      socket.emit('check_clue1_answer', 'correct');
    });

    socket.on('check_clue2_answer', () => {
        console.log('Checking clue 2 answer');
        socket.emit('check_clue2_answer', 'correct');
    });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


