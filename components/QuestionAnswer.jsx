import React, { useEffect, useState, useRef } from "react";
export default function QuestionAnswer(props){
        const [field1, setField1] = useState("");
        const [field2, setField2] = useState("");

        const [clue1, setClue1] = useState("");
        const [clue2, setClue2] = useState("");
        const [jwclue, setJwclue] = useState("");


        const [questionIndex, setQuestionIndex] = useState(0);

        const [roomId, setRoomId] = useState(props.roomId);
        const [newWordTimer, setNewWordTimer] = useState(10);    
        // const [timerActive, setTimerActive] = useState(false);

        const timerActiveRef = useRef(false);


        useEffect(() => {
            function setClue1Result(clue1Answer){
                if(clue1Answer && !timerActiveRef.current){
                    setField1(clue1Answer); // TODO: make it so that user cant type again using 
                    console.log("Clue 1 answer received:", clue1Answer, timerActiveRef.current); 
                }else{
                    setField1("");
                }
            }
            props.socket.on("check_clue1_answer", setClue1Result);

            function setClue2Result(clue2Answer){
                if(clue2Answer && !timerActiveRef.current){
                    setField2(clue2Answer); // TODO: make it so that user cant type again using css 
                    console.log("Clue 2 answer received:", clue2Answer); 
                }else{
                    setField2("");
                }
            }
            props.socket.on("check_clue2_answer", setClue2Result);

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
    
        const handleKeyDown = (event, field) => {
            if (event.key === "Enter" && !timerActiveRef.current) {
                if (field === "field1") {
                    console.log("Field 1 entered:", field1);
                    //validate clue-1 on server side to prevent cheating
                    props.socket.emit("check_clue1_answer", {questionIndex, field1, roomId});
                } else if (field === "field2") {
                    console.log("Field 2 entered:", field2);
                    props.socket.emit("check_clue2_answer", {questionIndex, field2, roomId});
                    // setField2(""); 
                }
                
            }else if(event.key === "Enter" && timerActiveRef.current){
                console.log("Timer active, cannot submit answer");
                setField1("");
                setField2
            }
        };

        // TODO: load data from database
        // console.log(data);


    return (
        <>
            {timerActiveRef.current && <p>New Word in {newWordTimer}</p>}

            {/* {timerActive && <p>New Word in {newWordTimer}</p>} */}
            <div className="clue-1">
                <p>{clue1}</p>
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
                <p>{clue2}</p>
                <input
                    type="text"
                    value={field2}
                    className="clue-2-input"
                    onChange={(e) => setField2(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "field2")}
                    placeholder="Field 2: Type and press Enter"
                />
            </div>

            <p className="clue-3-txt">{jwclue}</p>
            <p className="answer">Answer display</p>
        </>
    )
}