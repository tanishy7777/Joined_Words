import React, { useState, useEffect } from "react";
import QuestionAnswer from "./QuestionAnswer";
import { socket } from "../socket";
import Leaderboard from "./Leaderboard";
import { useAuth } from "../src/contexts/AuthContext";
import RoomId from "./RoomId";

export default function Game(props) {
    const [timer, setTimer] = useState(null);
    const [score, setScore] = useState(null);

    const { user } = useAuth(); 

    useEffect(() => {
        function startTimer(countdownTime) {
            setTimer(countdownTime);
            console.log('Game started from useEffect');
        }
        props.socket.on('game_started', startTimer);

        function updateTimer(remainingTime) {
            console.log('Time remaining:', remainingTime);
            setTimer(remainingTime);
        }
        props.socket.on('update_timer', updateTimer);

        function setInitialScore(remainingScore){
            setScore(remainingScore);
            console.log('Initial score set', remainingScore);
        }
        props.socket.on('get_score', setInitialScore);
    
        function updateScore(remainingScore){
            setScore(remainingScore);
        }
        props.socket.on('score_update', updateScore);

        function endGame(){
            console.log('Game ended');
        }

        props.socket.on('end_game', endGame);
    
        return () => {
          props.socket.off('game_started', startTimer);
          props.socket.off('update_timer', updateTimer);
          props.socket.off('get_score', setInitialScore);
          props.socket.off('score_update', updateScore);
          props.socket.off('end_game', endGame);
        };
      }, [props.socket]);

    
    return (
        <div>
            <h1>Game Component</h1>
            <RoomId roomId={props.roomId} />            
            <p className="time-txt">Time left: {timer}</p>
            <p className="score-txt">Score: {score}</p>


            <QuestionAnswer socket={socket} roomId={props.roomId}/>
            <Leaderboard socket={socket} roomId={props.roomId} currentUserUid={user?.uid}  />
            

        </div>
    )
}