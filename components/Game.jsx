import React, { useState, useEffect } from "react";
export default function Game(props) {
    const [field1, setField1] = useState("");
    const [field2, setField2] = useState("");

    const handleKeyDown = (event, field) => {
        if (event.key === "Enter") {
        if (field === "field1") {
            console.log("Field 1 entered:", field1);
            setField1(""); 
        } else if (field === "field2") {
            console.log("Field 2 entered:", field2);
            setField2(""); 
        }
        }
    };

    const [timer, setTimer] = useState(null);

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
    
        function endGame(){
            console.log('Game ended');
        }
        props.socket.on('end_game', endGame);
    
        return () => {
          props.socket.off('game_started', startTimer);
          props.socket.off('update_timer', updateTimer);
          props.socket.off('end_game', endGame);
        };
      }, [props.socket]);

    return (
        <div>
            <h1>Game Component</h1>
            <p>Room id: {props.roomId}</p>
            <p className="time-txt">Time left: {timer}</p>

            <div className="clue-1">
                <input
                    type="text"
                    value={field1}
                    className="clue-1-input"
                    onChange={(e) => setField1(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "field1")}
                    placeholder="Field 1: Type and press Enter"
                />
            </div>
            <br />
            <div className="clue-2">
                <input
                    type="text"
                    value={field2}
                    className="clue-2-input"
                    onChange={(e) => setField2(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "field2")}
                    placeholder="Field 2: Type and press Enter"
                />
            </div>

            <p className="clue-3-txt">Clue 3</p>
            <p className="answer">Answer</p>

            <div className="hint-div">
                <div>
                    <button className="hint-l1-btn">L1</button>
                    <button className="hint-n1-btn">N1</button>
                </div>
                <div>
                    <button className="hint-l2-btn">L2</button>
                    <button className="hint-n2-btn">N2</button>
                </div>
            </div>
        </div>
    )
}