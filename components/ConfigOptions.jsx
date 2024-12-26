export default function ConfigOptions(props){
    function startGame(formData){
        console.log('Starting game');
        const numOfWords =  formData.get("num_of_words");
        const timePerQuestion = formData.get("time_per_question");
        // tell server that game started and fetch question, hint, clues and start timer
        console.log('Starting game with:', numOfWords, timePerQuestion);
        props.socket.emit('start_game', props.roomId, numOfWords, timePerQuestion, false);
    }

    return(
        <>
            <h3>Game Configuration</h3>
            <form action={startGame}>
                <fieldset>
                    <legend>Number of words</legend>
                    <label>
                        <input type="radio" name="num_of_words" value={1}></input>
                        1 word
                    </label>

                    <label>
                        <input type="radio" name="num_of_words" value={3} defaultChecked={true}></input>
                        3 words
                    </label>

                    <label>
                        <input type="radio" name="num_of_words" value={5} ></input>
                        5 words
                    </label>
                    
                </fieldset>

                <fieldset>
                    <legend>Time per Question</legend>
                    <label>
                        <input type="radio" name="time_per_question" value={1} defaultChecked={true}></input>
                        1 min
                    </label>
                    <label>
                        <input type="radio" name="time_per_question" value={2}></input>
                        2 min
                    </label>
                    <label>
                        <input type="radio" name="time_per_question" value={3}></input>
                        3 min
                    </label>
                </fieldset>

                <button >Start Game</button>

            </form>
            
        </>
    )
}