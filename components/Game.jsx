import React, { useState, useEffect } from "react";
import QuestionAnswer from "./QuestionAnswer";
import { socket } from "../socket";
import Leaderboard from "./Leaderboard";
import Hints from "./Hints";
import RoomId from "./RoomId";

export default function Game(props) {
    const [timer, setTimer] = useState(null);
    const [score, setScore] = useState(null);
    const [hintsAvailable, setHintsAvailable] = useState(0);

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

        function setInitialHints(hintsAvailable){
            if (hintsAvailable <= 3){
                setHintsAvailable(hintsAvailable);
            }
        }

        props.socket.on('get_hints_available', setInitialHints);

        function unlockHint(hintsAvailable){
            if (hintsAvailable <= 3){
                setHintsAvailable(hintsAvailable);
            }
        }
        props.socket.on('unlock_hint', unlockHint);

        function endGame(){
            console.log('Game ended');
        }

        props.socket.on('end_game', endGame);
    
        return () => {
          props.socket.off('game_started', startTimer);
          props.socket.off('update_timer', updateTimer);
          props.socket.off('get_score', setInitialScore);
          props.socket.off('score_update', updateScore);
          props.socket.off('get_hints_available', setInitialHints);
          props.socket.off('unlock_hint', unlockHint);
          props.socket.off('end_game', endGame);
        };
      }, [props.socket]);

    
    return (
        <div>
            <h1>Game Component</h1>
            <RoomId roomId={props.roomId} />            
            <p className="time-txt">Time left: {timer}</p>
            <p className="score-txt">Score: {score}</p>
            <p className="hints-available-txt">Hints: {hintsAvailable}</p>


            <QuestionAnswer socket={socket} roomId={props.roomId}/>

            <Leaderboard socket={socket} />

            <Hints roomId={props.roomId} socket={socket}/>

        </div>
    )
}