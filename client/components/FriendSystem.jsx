// components/FriendSystem.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { socket } from '../socket';

export default function FriendSystem() {
    const [friendRequests, setFriendRequests] = useState([]);
    const [friends, setFriends] = useState([]);
    const [searchNickname, setSearchNickname] = useState('');

    useEffect(() => {
        // Listen for friend request notifications
        socket.on('friend_request_received', (data) => {
            setFriendRequests(prev => [...prev, data]);
        });

        return () => {
            socket.off('friend_request_received');
        };
    }, []);

    const sendFriendRequest = () => {
        if (searchNickname.trim()) {
            socket.emit('send_friend_request', { 
                receiverNickname: searchNickname.trim() 
            }, (response) => {
                if (response.success) {
                    alert('Friend request sent!');
                    setSearchNickname('');
                } else {
                    alert(`Failed: ${response.reason}`);
                }
            });
        }
    };

    const respondToRequest = (requestId, response) => {
        socket.emit('respond_friend_request', { requestId, response }, (result) => {
            if (result.success) {
                setFriendRequests(prev => 
                    prev.filter(req => req.requestId !== requestId)
                );
                if (response === 'accepted') {
                    // Refresh friends list
                    loadFriends();
                }
            }
        });
    };

    return (
        <div className="friend-system">
            <h3>Friends</h3>
            
            <div className="add-friend">
                <input
                    type="text"
                    placeholder="Enter nickname to add friend"
                    value={searchNickname}
                    onChange={(e) => setSearchNickname(e.target.value)}
                />
                <button onClick={sendFriendRequest}>Send Request</button>
            </div>

            <div className="friend-requests">
                <h4>Pending Requests ({friendRequests.length})</h4>
                {friendRequests.map(request => (
                    <div key={request.requestId} className="request-item">
                        <span>{request.sender.nickname} wants to be friends</span>
                        <button onClick={() => respondToRequest(request.requestId, 'accepted')}>
                            Accept
                        </button>
                        <button onClick={() => respondToRequest(request.requestId, 'declined')}>
                            Decline
                        </button>
                    </div>
                ))}
            </div>

            <div className="friends-list">
                <h4>My Friends ({friends.length})</h4>
                {friends.map(friend => (
                    <div key={friend.uid} className="friend-item">
                        <span>{friend.nickname}</span>
                        <button onClick={() => inviteToGame(friend.uid)}>
                            Invite to Game
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}