import React, { useEffect, useState, useRef } from "react";
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
        const timerActiveRef = useRef(false);

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

        useEffect(() => {
            function handlePlayerSync(data) {
                console.log("Player state sync received:", data);
                // data.score is handled by the parent component, but we can handle the cards here.
                if (data.answer1) {
                    setAnswer1(data.answer1);
                    setFlipped1(true);
                }
                if (data.answer2) {
                    setAnswer2(data.answer2);
                    setFlipped2(true);
                }
            }

            props.socket.on("player_state_sync", handlePlayerSync);

            return () => {
                // ... your other cleanup functions ...
                props.socket.off("player_state_sync", handlePlayerSync);
            };
        }, [props.socket]); // Add props.socket to dependency array if your linter suggests it

        useEffect(() => {
            props.socket.on("check_clue1_answer", setClue1Result);
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
            props.socket.emit('request_initial_game_state', props.roomId);

            function populateQuestionData(questionData) {
                setQuestionIndex(questionData.questionIndex);
                setClue1(questionData.clue1);
                setClue2(questionData.clue2);
                setJwclue(questionData.jwclue);
                console.log("Question data received:", questionData);
            }
            props.socket.on("get_question_data", populateQuestionData);

            function handlePlayerSync(data) {
                console.log("✅ Player state sync received:", data);
                if (data.answer1) {
                    setAnswer1(data.answer1);
                    setFlipped1(true);
                }
                if (data.answer2) {
                    setAnswer2(data.answer2);
                    setFlipped2(true);
                }
            }
            props.socket.on("player_state_sync", handlePlayerSync);
            

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
                        props.socket.emit("start_game", gameParams.roomId, gameParams.numOfWords, gameParams.timePerQuestion, true, null); // Emit the start_game event
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
                props.socket.off("player_state_sync", handlePlayerSync);
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

    return (
    <div className="space-y-4">
        {/* Countdown to next word */}
        {timerActiveRef.current && (
        <p className="text-sm text-blue-600 italic">Next word in {newWordTimer}s</p>
        )}

        {/* Clue Cards */}
        {/* Clue Cards */}
            {/* Clue Cards */}
<div className="flex space-x-4">
  {[{ front: clue1, back: answer1, flipped: flipped1 },
    { front: clue2, back: answer2, flipped: flipped2 }
  ].map((c, i) => (
    <div
      key={i}
      className={`
        w-40 h-24 rounded-lg p-3 flex flex-col items-center justify-center
        transition-colors duration-300
        ${c.flipped
          ? 'bg-green-100 border border-green-200'
          : 'bg-white border border-blue-200'}
      `}
    >
      {c.flipped ? (
        <>
          <p className="text-green-900 font-semibold mb-1">{c.back}</p>
          <span className="text-2xl">🎉</span>
        </>
      ) : (
        <p className="text-blue-800">{c.front}</p>
      )}
    </div>
  ))}
</div>

        {/* Answer Input */}
        <input
        type="text"
        value={field}
        onChange={(e) => setField(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type answer and press Enter"
        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Joined Word Display */}
        <p className="text-blue-900 font-medium">Joined Word: <span className="font-semibold">{jwclue}</span></p>
    </div>
    );

}