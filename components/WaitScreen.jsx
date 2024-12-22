export default function WaitScreen(props){
    // if is host then show config options
    function startGame(){
        console.log('Starting game');
        // tell server that game started and fetch question, hint, clues and start timer
        props.socket.emit('start_game', props.roomId);
    }
 
    return (
        <div>
            <p>Room ID: {props.roomId}</p>
            <h1>Waiting for other player to join...</h1>
            <h3>How to play</h3>
            <p>todo: write rules and reg</p>
            {props.isRoomAdmin && <button onClick={startGame}>Start Game</button>}
        </div>
    )
}