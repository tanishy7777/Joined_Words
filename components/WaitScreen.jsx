import ConfigOptions from "./ConfigOptions"
import RoomId from "./RoomId";

export default function WaitScreen(props){
    // if is host then show config options

 
    return (
        <div>

            <RoomId roomId={props.roomId} />

            {/* <div id="room-id-div">
                <p id="room-id-txt">Room ID: {props.roomId}</p>
                <button id="copy-link-btn" onClick={copyLinkToClipboard}>
                   
                    <img
                        src="https://img.icons8.com/?size=100&id=86201&format=png&color=E5E1E1"
                        alt="Copy Icon"
                        style={{ width: "20px", height: "20px" }}
                    />
               
                </button>
            </div> */}
            
            <div className="info-txt">
                <h1 id="waiting-text">Waiting for other player to join...</h1>
                <h3 id="how-to-play-txt">How to play</h3>
                <p id="rules-txt">todo: write rules and reg Lorem, ipsum dolor sit amet consectetur adipisicing elit. Accusantium quam atque quisquam eaque minima nulla perspiciatis nisi? Aut officiis accusamus, reiciendis iusto exercitationem blanditiis modi optio impedit necessitatibus rerum sint.</p>
            </div>
            {props.isRoomAdmin && <ConfigOptions roomId={props.roomId} socket={props.socket} />}
        </div>
    )
}