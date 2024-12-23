import React, { useEffect, useState } from 'react';

export default function Leaderboard(props) {
    const [leaderboard, setLeaderboard] = useState({});

    useEffect(() => {
        props.socket.on('update_leaderboard', (players) => {
            setLeaderboard(players);
        });

        props.socket.emit('get_leaderboard', props.roomId);

        // Cleanup socket listener on unmount
        return () => {
            props.socket.off('update_leaderboard');
        };
    }, [props.socket, props.roomId]);

    return (
        <div>
            <h1>Leaderboard</h1>
            <table>
                <thead>
                    <tr>
                        <th>Socket ID</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.keys(leaderboard).map((socketId) => (
                        <tr key={socketId}>
                            <td>{socketId}</td>
                            <td>{leaderboard[socketId].playerScoreForCurrentWord}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
