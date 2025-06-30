import React, { useState } from 'react';
import ConfigOptions from "./ConfigOptions";
import RoomId from "./RoomId";
// import FriendSystem from "./FriendSystem";

export default function WaitScreen(props) {
  const [showFriends, setShowFriends] = useState(false);

  return (
    <div>
      <div className="wait-screen-header">
        <RoomId roomId={props.roomId} />
        {/* <button onClick={() => setShowFriends(true)}>
          Friends
        </button> */}
      </div>
      
      <h2 id="waiting-text">Waiting for game to start...</h2>
      <p id="how-to-play-txt">How to play?</p>
      <p id="rules-txt">
        Lorem, ipsum dolor sit amet consectetur adipisicing elit...
      </p>
      
      {props.isRoomAdmin && <ConfigOptions {...props} />}
      
      {/* <FriendSystem 
        isOpen={showFriends} 
        onClose={() => setShowFriends(false)} 
      /> */}
    </div>
  );
}
