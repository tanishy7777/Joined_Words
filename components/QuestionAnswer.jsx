import React, { useEffect, useState } from "react";
import data from '../data.json'
export default function QuestionAnswer(props){
        const [field1, setField1] = useState("");
        const [field2, setField2] = useState("");

        const [clue1, setClue1] = useState("");
        const [clue2, setClue2] = useState("");
        const [jwclue, setJwclue] = useState("");

        useEffect(()=>{
            function populateQuestionData(questionData) {
                setClue1(questionData.clue1);
                setClue2(questionData.clue2);
                setJwclue(questionData.jwclue);
                console.log("Question data received:", questionData);
            }
            props.socket.on("get_question_data", populateQuestionData);

            function setClue1Result(clue1Answer){
                if(clue1Answer){
                    setField1(clue1Answer); // TODO: make it so that user cant type again using css 
                }else{
                    setField1("");
                }
            }
            props.socket.on("check_clue1_answer", setClue1Result);

            function setClue2Result(clue2Answer){
                if(clue2Answer){
                    setField2(clue2Answer); // TODO: make it so that user cant type again using css 
                }else{
                    setField2("");
                }
            }
            props.socket.on("check_clue2_answer", setClue2Result);
        }, []);
    
        const handleKeyDown = (event, field) => {
            if (event.key === "Enter") {
            if (field === "field1") {
                console.log("Field 1 entered:", field1);
                //validate clue-1 on server side to prevent cheating
                props.socket.emit("check_clue1_answer");
                // setField1(""); 
            } else if (field === "field2") {
                console.log("Field 2 entered:", field2);
                props.socket.emit("check_clue2_answer");
                // setField2(""); 
            }
            }
        };

        // TODO: load data from database
        // console.log(data);


    return (
        <>
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