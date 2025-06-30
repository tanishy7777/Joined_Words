import React from 'react';
export default function RoomId(props) {

    function copyLinkToClipboard(){
        const roomLink = window.location.href;
        navigator.clipboard.writeText(roomLink);
    }

    return (
        <div id="room-id-div">
            <p id="room-id-txt">Room ID: {props.roomId}</p>
            <button id="copy-link-btn" onClick={copyLinkToClipboard}>
            
                <img
                    src="https://img.icons8.com/?size=100&id=86201&format=png&color=E5E1E1"
                    alt="Copy Icon"
                    style={{ width: "20px", height: "20px" }}
                />
        
            </button>
        </div>
    );
}