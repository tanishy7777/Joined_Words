
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
          score: {},  // this score is displayed on the screen
          // TODO make this a list of size => no of players [100, 100, 100,...]
          hintsAvailable: 0,
          data: data,
          players: {},
          admin: socket.id,
          totalWords: null,
          hintsUsed: {}
        };

        // add admin to players 
        gameStates[roomId].players[socket.id] = { playerScore: 0 }; 
        gameStates[roomId].hintsUsed[socket.id] = [false, false, false, false];
        gameStates[roomId].score[socket.id] = 100;
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players); 
    });

    socket.on('join_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room joined:', roomId);
        socket.emit('load_game_component');
        const currentState = gameStates[roomId];
        if (currentState) {
            io.to(roomId).emit('get_hints_available', currentState.hintsAvailable);

            currentState.players[socket.id] = { playerScore: 0 }; 
            currentState.hintsUsed[socket.id] = [false, false, false, false];
            currentState.score[socket.id] = 100;
            io.to(roomId).emit('update_leaderboard', currentState.players);
        }
    });

    socket.on('get_leaderboard', (roomId) => {
      const currentState = gameStates[roomId];
      if (currentState) {
          io.to(roomId).emit('update_leaderboard', currentState.players);
      }
   });


    socket.on('start_game', (roomId, numOfWords, timePerQuestion, isLoop)  => {
      
      console.log(`Game started in room: ${roomId}`);
      console.log('Number of words:', numOfWords, 'Time per question:', timePerQuestion);
      if(!isLoop){
          io.to(roomId).emit('load_game_component');
          console.log(gameStates);
          gameStates[roomId].totalWords = numOfWords;
        }
        const questionData = {
          questionIndex: gameStates[roomId].totalWords - numOfWords,
          clue1: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].clue1,
          clue2: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].clue2,
          jwclue: gameStates[roomId].data[gameStates[roomId].totalWords - numOfWords].jwclue,
        };
        
        
        numOfWords--; 
        // let totalTime = timePerQuestion*60;
        let totalTime = 10;
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
        
        // io.to(roomId).emit('get_question_data', questionData);
        // Added this delay to ensure that the client has loaded the game component
        setTimeout(() => {
          io.to(roomId).emit('get_question_data', questionData);
          io.to(roomId).emit('get_score', gameStates[roomId].score[socket.id]); // Added this from join_room 
        }, 10);  

        io.to(roomId).emit('game_started', countdownTime);
        // io.to(roomId).emit('get_score', remainingScore)
    
        gameInterval = setInterval(() => {
          countdownTime--;
          if((totalTime - countdownTime)%15==0){
            remainingScore-=timePenalty;
            hintsAvailable+=1;
            gameStates[roomId].score[socket.id] = remainingScore;
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
              Object.keys(currentState.players).forEach(playerId => {
                currentState.players[playerId].playerScore += currentState.score[socket.id];
                console.log("Updating Leaderboard for", playerId, currentState.score[socket.id]);
              });
              io.to(roomId).emit('update_leaderboard', currentState.players);
              console.log("Updating Leaderboard", currentState.players);
            }

            if(numOfWords > 0){       
              io.to(gameStates[roomId].admin).emit("game_restart", {roomId, numOfWords, timePerQuestion});
              socket.broadcast.to(roomId).emit("next_word_in");
              console.log("Next word in");
            }else{
              io.to(roomId).emit('end_game');
            }
          }

        }, 1000);
      });
    
    socket.on('check_clue1_answer', ({questionIndex, field1, roomId}) => {
      console.log('Checking clue 1 answer', questionIndex, field1);
      console.log(gameStates[roomId], roomId, gameStates);
      if(roomId){
        if(field1.toLowerCase() === gameStates[roomId].data[questionIndex].answer1.toLowerCase()){
          socket.emit('check_clue1_answer', field1.toLowerCase());
        }else{
          socket.emit('check_clue1_answer', null);
        }
      }
      
    });

    socket.on('check_clue2_answer', ({questionIndex, field2, roomId}) => {
      console.log('Checking clue 2 answer');
      if(roomId){
        if(field2.toLowerCase() === gameStates[roomId].data[questionIndex].answer2.toLowerCase()){
          socket.emit('check_clue2_answer', field2.toLowerCase());
        }else{
          socket.emit('check_clue2_answer', null);
        }
      }else{
        console.log('Room not found');
      }
      
    });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


