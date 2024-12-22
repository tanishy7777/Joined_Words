
import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import cors from 'cors';

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

io.on('connection',  (socket) => {
    console.log('New client connected'); 

    socket.on('create_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room created:', roomId);
    });

    socket.on('join_room', roomId => {
        socket.join(roomId); 
        console.log(socket.rooms);
        console.log('room joined:', roomId);
    });

    // socket.on('start_game', roomId => {
    //     console.log('Starting game');
    //     io.to(roomId).emit('game_started');
    //     // start timer
    // });

    socket.on('start_game', roomId  => {
        console.log(`Game started in room: ${roomId}`);
        // TODO: fetch question, hint, clues from db
        let countdownTime = 60; 
        let gameInterval;
        let startTime;

        startTime = Date.now();
        console.log(roomId);
        console.log(socket.id);
        console.log(socket.rooms); // It should list all the rooms the socket is connected to

        io.to(roomId).emit('game_started', countdownTime);
    
        // Start the countdown timer
        gameInterval = setInterval(() => {
          countdownTime--;
          console.log(countdownTime);
          io.to(roomId).emit('update_timer', countdownTime);
          if (countdownTime <= 0) {
            clearInterval(gameInterval);
            io.to(roomId).emit('end_game');
          }
        }, 1000);
      });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


