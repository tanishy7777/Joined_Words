import React, { useEffect, useState, useRef } from "react";
import { use } from "react";
export default function QuestionAnswer(props){
        const [field, setField] = useState("");
        const [flipped1, setFlipped1] = useState(false);
        const [flipped2, setFlipped2] = useState(false);

        const [clue1, setClue1] = useState("");
        const [clue2, setClue2] = useState("");
        const [jwclue, setJwclue] = useState("");

        const [answer1, setAnswer1] = useState("");
        const [answer2, setAnswer2] = useState("");
        

        const [questionIndex, setQuestionIndex] = useState(0);

        const [roomId, setRoomId] = useState(props.roomId);
        const [newWordTimer, setNewWordTimer] = useState(10);    
        // const [timerActive, setTimerActive] = useState(false);

        const timerActiveRef = useRef(false);


        useEffect(() => {
            function setClue1Result(clue1Answer){
                if(clue1Answer && !timerActiveRef.current){
                    setFlipped1(true);
                    setField("");
                    setAnswer1(clue1Answer);
                    console.log("Clue 1 answer received:", clue1Answer, timerActiveRef.current); 
                }else{
                    setField("");
                }
            }
            props.socket.on("check_clue1_answer", setClue1Result);

            function setClue2Result(clue2Answer){
                if(clue2Answer && !timerActiveRef.current){
                    setFlipped2(true);
                    setField("");
                    setAnswer2(clue2Answer);
                    console.log("Clue 2 answer received:", clue2Answer); 
                }else{
                    setField("");
                }
            }
            props.socket.on("check_clue2_answer", setClue2Result);

            function newWord(){
                setFlipped1(false);
                setFlipped2(false);
                setClue1("loading...");
                setClue2("loading...");
                setField("");  
            }
            props.socket.on("clear_field_new_word", newWord);

        }  , []);


        useEffect(()=>{
            function populateQuestionData(questionData) {
                setQuestionIndex(questionData.questionIndex);
                setClue1(questionData.clue1);
                setClue2(questionData.clue2);
                setJwclue(questionData.jwclue);
                console.log("Question data received:", questionData);
            }
            props.socket.on("get_question_data", populateQuestionData);
            

            function updateUI(gameParams) {
                let timer = 10;
                // setTimerActive(true); 
                timerActiveRef.current = true; // Use ref to track timer state

                setNewWordTimer(timer);
    
                const interval = setInterval(() => {
                    if (timer > 0) {
                        timer -= 1;
                        setNewWordTimer(timer);
                    } else {
                        clearInterval(interval);
                        timerActiveRef.current = false; // Use ref to track timer state

                        // setTimerActive(false); // Stop the timer
                        props.socket.emit("start_game", gameParams.roomId, gameParams.numOfWords, gameParams.timePerQuestion, true); // Emit the start_game event
                    }
                }, 1000);
            }
    
            props.socket.on("game_restart", updateUI); // only received by 

            function nextWordIn(){
                let timer = 10;
                // setTimerActive(true); 
                setNewWordTimer(timer);
                timerActiveRef.current = true; // Use ref to track timer state

                console.log("Next word in");

    
                const interval = setInterval(() => {
                    if (timer > 0) {
                        timer -= 1;
                        setNewWordTimer(timer);
                    } else {
                        timerActiveRef.current = false;
                        clearInterval(interval);
                        // setTimerActive(false); // Stop the timer
                    }
                }, 1000);
            }
            props.socket.on("next_word_in", nextWordIn);

            function endGame(){
                console.log("Game ended");
                timerActiveRef.current = true;
            }
            props.socket.on("end_game", endGame);

            return () => {
                props.socket.off("get_question_data", populateQuestionData);
                props.socket.off("check_clue1_answer", setClue1Result);
                props.socket.off("check_clue2_answer", setClue2Result);
                props.socket.off("end_game", endGame);
            }
        }, []);
    
        const handleKeyDown = (event) => {
            if (event.key === "Enter" && !timerActiveRef.current) {
                console.log("Field 1 entered:", field);
                //validate clue-1 on server side to prevent cheating
                props.socket.emit("check_clue_answer", {questionIndex, field, roomId});
                
            }else if(event.key === "Enter" && timerActiveRef.current){
                console.log("Timer active, cannot submit answer");
                setField("");
            }
        };

        // TODO: load data from database
        // console.log(data);


    return (
        <>
            {timerActiveRef.current && <p>New Word in {newWordTimer}</p>}

            <div className="cards">
                <div className={`card ${flipped1 ? "flipped" : ""}`}>
                    <div className="front">
                        <p>{clue1}</p>
                    </div>
                    <div className="back">
                        <p>{answer1}</p>
                    </div>
                </div>
                <div className={`card ${flipped2 ? "flipped" : ""}`}>
                    <div className="front">
                        <p>{clue2}</p>
                    </div>
                    <div className="back">
                        <p>{answer2}</p>
                    </div>
                </div>
            </div>

            <input
                    type="text"
                    value={field}
                    className="clue-input"
                    onChange={(e) => setField(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e)}
                    placeholder="Field: Type and press Enter"
            />

            <p className="clue-3-txt">Joined Word: {jwclue}</p>
            <p className="answer">Answer display</p>
        </>
    )
}