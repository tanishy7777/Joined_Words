import React, { useState } from 'react';
import ConfigOptions from "./ConfigOptions";
import RoomId from "./RoomId";
import { useAuth } from '../src/contexts/AuthContext';


export default function WaitScreen(props) {
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
      
      <div className="player-list">
        {players && Object.entries(players).map(([uid, p]) => (
          <div key={uid} className="player-row">
            <span>{p.nickname}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
