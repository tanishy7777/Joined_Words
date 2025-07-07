import React from 'react';
export default function ConfigOptions(props) {
    const handleConfigChange = (setting, value) => {
        props.socket.emit('update_config', props.roomId, {
            [setting]: value
        });
    };

    const startGame = (e) => {
        e.preventDefault();
        console.log('Start game clicked');
        props.socket.emit('start_game', props.roomId, false);
    };

    return (
        <div className="config-options-div">
            <h3>Game Configuration</h3>
            <form onSubmit={startGame}>
                {/* Number of words field */}
                <fieldset id="num-of-words">
                    <legend>Number of words</legend>
                    {[1, 3, 5].map(num => (
                        <label key={num}>
                            <input
                                type="radio"
                                name="num_of_words"
                                value={num}
                                defaultChecked={num === 3}
                                onChange={(e) => handleConfigChange('numOfWords', Number(e.target.value))}
                            />
                            {num} word{num !== 1 ? 's' : ''}
                        </label>
                    ))}
                </fieldset>

                {/* Time per question field */}
                <fieldset id="time-per-question">
                    <legend>Time per Question</legend>
                    {[1, 2, 3].map(time => (
                        <label key={time}>
                            <input
                                type="radio"
                                name="time_per_question"
                                value={time}
                                defaultChecked={time === 1}
                                onChange={(e) => handleConfigChange('timePerQuestion', Number(e.target.value))}
                            />
                            {time} min
                        </label>
                    ))}
                </fieldset>

                {/* Privacy field */}
                <fieldset id="private-game">
                    <legend>Private Game?</legend>
                    <label>
                        <input
                            type="radio"
                            name="private_game"
                            value="yes"
                            defaultChecked
                            onChange={() => handleConfigChange('isPrivateGame', true)}
                        />
                        Yes
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="private_game"
                            value="no"
                            onChange={() => handleConfigChange('isPrivateGame', false)}
                        />
                        No
                    </label>
                </fieldset>

                <button id="start-game-btn">Start Game</button>
            </form>
        </div>
    );
}
