import React, { useState } from 'react';
import ConfigOptions from "./ConfigOptions";
import RoomId from "./RoomId";
import ChatWindow from "./ChatWindow";
import { useAuth } from '../src/contexts/AuthContext';

// import FriendSystem from "./FriendSystem";

export default function WaitScreen(props) {
  const [showFriends, setShowFriends] = useState(false);
  const { isRoomAdmin, roomId, socket, players } = props;
  const { user } = useAuth();
  return (
    <div>
      <div className="wait-screen-header">
        <RoomId roomId={roomId} />
      </div>
      
      <h2 id="waiting-text">Waiting for game to start...</h2>
      <p id="how-to-play-txt">How to play?</p>
      <p id="rules-txt">
        Lorem, ipsum dolor sit amet consectetur adipisicing elit...
      </p>
      
      {isRoomAdmin && <ConfigOptions {...props} />}
      
      {/* player list */}
      <div className="player-list">
        {players && Object.entries(players).map(([uid, p]) => (
          <div key={uid} className="player-row">
            <span>{p.nickname}</span>
            {uid !== user.uid && (                       /* hide button for self */
              <button
                onClick={() =>
                  socket.emit('send_friend_request', { targetUserUid: uid }, (res) =>
                    alert(res.success ? 'Request sent' : res.reason)
                  )
                }
                title="Add friend"
              >
                🤝
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
