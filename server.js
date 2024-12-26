
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
          questionIndex: 0,
          timer: null,
          score: {},  // this score is displayed on the screen
          hintsAvailable: {},
          data: data,
          players: {},
          admin: socket.id,
          totalWords: null,
          hintsUsed: {},
          cluesAnswered: {},
        };

        // add admin to players 
        gameStates[roomId].players[socket.id] = { playerScore: 0 }; 
        gameStates[roomId].hintsUsed[socket.id] = [false, false, false, false];
        gameStates[roomId].hintsAvailable[socket.id] = 0;
        gameStates[roomId].score[socket.id] = 100;
        gameStates[roomId].cluesAnswered[socket.id] = [false, false];
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players); 
    });

    socket.on('join_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room joined:', roomId);
        // socket.emit('load_game_component');
        const currentState = gameStates[roomId];
        if (currentState) {
            currentState.hintsAvailable[socket.id] = 0;

            io.to(roomId).emit('get_hints_available', currentState.hintsAvailable[socket.id]);

            currentState.players[socket.id] = { playerScore: 0 }; 
            currentState.hintsUsed[socket.id] = [false, false, false, false];
            currentState.score[socket.id] = 100;
            currentState.cluesAnswered[socket.id] = [false, false];
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
              const usedHintsCount = gameStates[roomId].hintsUsed[playerId].filter(hint => hint).length;
              if(gameStates[roomId].hintsAvailable[playerId] + usedHintsCount < 3){
                gameStates[roomId].hintsAvailable[playerId] += 1;
                console.log("Updating hintsAvailable for", playerId, gameStates[roomId].hintsAvailable[playerId]); 
              }
              io.to(playerId).emit('unlock_hint', gameStates[roomId].hintsAvailable[playerId]);
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
            // reset hints and max_score
            Object.keys(gameStates[roomId].players).forEach(playerId => {
              gameStates[roomId].hintsAvailable[playerId] = 0;
              gameStates[roomId].hintsUsed[playerId] = [false, false, false, false];
              gameStates[roomId].score[playerId] = 100;
              io.to(playerId).emit('get_hints_available', gameStates[roomId].hintsAvailable[socket.id]);
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
    

    socket.on('check_clue1_answer', ({questionIndex, field1, roomId}) => {
      console.log('Checking clue 1 answer', questionIndex, field1);
      console.log(gameStates[roomId], roomId, gameStates);
      if(roomId){
        if(field1.toLowerCase() === gameStates[roomId].data[questionIndex].answer1.toLowerCase()){
          socket.emit('check_clue1_answer', field1.toLowerCase());
          gameStates[roomId].cluesAnswered[socket.id][0] = true;
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
          gameStates[roomId].cluesAnswered[socket.id][1] = true;
        }else{
          socket.emit('check_clue2_answer', null);
        }
      }else{
        console.log('Room not found');
      }
      
    });

    // TODO: allow to retrive hints only after for those clues that havent been answered (done)
    // TODO dont allow same hint to be used again (done)
    // TODO: Use react router to have shareable links for rooms
    // TODO display the hint text

    // L1, N1, L2, N2
    socket.on("hint_l1_clicked", (roomId)=>{
      console.log('Hint L1 clicked');
      // check if hints available
      if(gameStates[roomId].hintsAvailable[socket.id] > 0 && gameStates[roomId].hintsUsed[socket.id][0] === false && gameStates[roomId].cluesAnswered[socket.id][0] === false){
        
        gameStates[roomId].hintsAvailable[socket.id] -= 1;
        gameStates[roomId].hintsUsed[socket.id][0] = true;
        // update score if used a hint
        gameStates[roomId].score[socket.id] -= 10;
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players);
        io.to(socket.id).emit('get_hints_available', gameStates[roomId].hintsAvailable[socket.id]);
        io.to(socket.id).emit('show_hint', gameStates[roomId].data[gameStates[roomId].questionIndex].answer1.length);
        io.to(socket.id).emit('score_update', gameStates[roomId].score[socket.id]);

      }else{
        console.log('No hints available');
      }
    });
    
    socket.on("hint_n1_clicked", (roomId)=>{
      console.log('Hint N1 clicked');
      // check if hints available
      if(gameStates[roomId].hintsAvailable[socket.id] > 0 && gameStates[roomId].hintsUsed[socket.id][1] === false && gameStates[roomId].cluesAnswered[socket.id][0] === false){
        gameStates[roomId].hintsAvailable[socket.id] -= 1;
        gameStates[roomId].hintsUsed[socket.id][1] = true;
        // update score if used a hint
        gameStates[roomId].score[socket.id] -= 10;
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players);
        io.to(socket.id).emit('get_hints_available', gameStates[roomId].hintsAvailable[socket.id]);
        io.to(socket.id).emit('show_hint', gameStates[roomId].data[gameStates[roomId].questionIndex].clue1.substring(0, 1) + '...');
        io.to(socket.id).emit('score_update', gameStates[roomId].score[socket.id]);

        // TODO display the hint text

      }else{
        console.log('No hints available');
      }
    });

    socket.on("hint_l2_clicked", (roomId)=>{
      console.log('Hint L2 clicked');
      // check if hints available
      if(gameStates[roomId].hintsAvailable[socket.id] > 0 && gameStates[roomId].hintsUsed[socket.id][2] === false && gameStates[roomId].cluesAnswered[socket.id][1] === false){
        gameStates[roomId].hintsAvailable[socket.id] -= 1;
        gameStates[roomId].hintsUsed[socket.id][2] = true;
        // update score if used a hint
        gameStates[roomId].score[socket.id] -= 10;
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players);
        io.to(socket.id).emit('get_hints_available', gameStates[roomId].hintsAvailable[socket.id]);
        io.to(socket.id).emit('show_hint', gameStates[roomId].data[gameStates[roomId].questionIndex].answer2.length);
        io.to(socket.id).emit('score_update', gameStates[roomId].score[socket.id]);


        // TODO display the hint text
      }else{
        console.log('No hints available');
      }
    });


    socket.on("hint_n2_clicked", (roomId)=>{
      console.log('Hint N2 clicked');
      // check if hints available
      console.log(gameStates[roomId].hintsAvailable[socket.id], gameStates[roomId].hintsUsed[3], gameStates[roomId].cluesAnswered[socket.id][1]);
      if(gameStates[roomId].hintsAvailable[socket.id] > 0 && gameStates[roomId].hintsUsed[socket.id][3] === false && gameStates[roomId].cluesAnswered[socket.id][1] === false){
        gameStates[roomId].hintsAvailable[socket.id] -= 1;
        gameStates[roomId].hintsUsed[socket.id][3] = true;
        // update score if used a hint
        gameStates[roomId].score[socket.id] -= 10;
        io.to(roomId).emit('update_leaderboard', gameStates[roomId].players);
        io.to(socket.id).emit('get_hints_available', gameStates[roomId].hintsAvailable[socket.id]);
        io.to(socket.id).emit('show_hint', gameStates[roomId].data[gameStates[roomId].questionIndex].clue2.substring(0, 1) + '...');
        io.to(socket.id).emit('score_update', gameStates[roomId].score[socket.id]);

        // TODO display the hint text

      }else{
        console.log('No hints available');
      }
    })
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


