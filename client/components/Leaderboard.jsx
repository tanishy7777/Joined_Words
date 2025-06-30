import React, { useEffect, useState } from 'react';

export default function Leaderboard({ socket, roomId, currentUserUid }) {
  const [leaderboard, setLeaderboard] = useState({});

  useEffect(() => {
    socket.on('update_leaderboard', (players) => {
      setLeaderboard(players);
    });
    socket.emit('get_leaderboard', roomId);

    return () => {
      socket.off('update_leaderboard');
    };
  }, [socket, roomId]);

  // Convert leaderboard object to array and sort by score (optional)
  const sortedPlayers = Object.entries(leaderboard)
    .map(([uid, data]) => ({
      uid,
      nickname: data.nickname || 'Anonymous',
      playerScore: data.playerScore || 0
    }))
    .sort((a, b) => b.playerScore - a.playerScore);

  return (
    <div className="leaderboard">
      <h3>Leaderboard</h3>
      <table>
        <thead>
          <tr>
            <th>Nickname</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <tr
              key={player.uid}
              className={player.uid === currentUserUid ? 'current-user' : ''}
            >
              <td>{player.nickname}</td>
              <td>{player.playerScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
