import ConfigOptions from "./ConfigOptions"
export default function WaitScreen(props){
    // if is host then show config options
    
 
    return (
        <div>
            <p>Room ID: {props.roomId}</p>
            <h1>Waiting for other player to join...</h1>
            <h3>How to play</h3>
            <p>todo: write rules and reg</p>
            {props.isRoomAdmin && <ConfigOptions roomId={props.roomId} socket={props.socket} />}
        </div>
    )
}