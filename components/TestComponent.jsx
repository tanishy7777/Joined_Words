import React, { useState } from "react";

export default function TestComponent() {
    const [field, setField] = useState("");
    const [flipped1, setFlipped1] = useState(false);
    const [flipped2, setFlipped2] = useState(false);

    const correctAnswers = {
        field1: "nutrition", 
        field2: "fruits",    
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            if (field.toLowerCase() === correctAnswers.field1) {
                setFlipped1(true);
                setField("");
            }
            if (field.toLowerCase() === correctAnswers.field2) {
                setFlipped2(true);
                setField("");
            }
        }
    };

    return (
        <div className="container">
            <div className="cards">
                <div className={`card ${flipped1 ? "flipped" : ""}`}>
                    <div className="front">
                        <p>An important aspect of food</p>
                    </div>
                    <div className="back">
                        <p>Nutrition</p>
                    </div>
                </div>
                <div className={`card ${flipped2 ? "flipped" : ""}`}>
                    <div className="front">
                        <p>You might see them on some plants</p>
                    </div>
                    <div className="back">
                        <p>Fruits</p>
                    </div>
                </div>
            </div>
            <input
                        type="text"
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e)}
                        placeholder="Type and press Enter"
            />
        </div>
    );
};

