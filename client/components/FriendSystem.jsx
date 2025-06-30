import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { socket } from '../socket';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';

export default function FriendSystem({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [searchNickname, setSearchNickname] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);

  // Search for users by nickname[34]
  const searchUsers = async () => {
    if (!searchNickname.trim()) return;
    
    try {
      const q = query(
        collection(db, 'users'), 
        where('nickname', '>=', searchNickname),
        where('nickname', '<=', searchNickname + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.uid !== user.uid) { // Exclude self
          results.push(userData);
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Send friend request[36]
  const sendFriendRequest = (targetUserUid) => {
    socket.emit('send_friend_request', { 
      targetUserUid 
    }, (response) => {
      if (response.success) {
        alert('Friend request sent!');
        setSearchResults(prev => 
          prev.filter(user => user.uid !== targetUserUid)
        );
      } else {
        alert(`Failed: ${response.reason}`);
      }
    });
  };

  // Respond to friend request
  const respondToRequest = (requestId, response) => {
    socket.emit('respond_friend_request', { 
      requestId, 
      response 
    }, (result) => {
      if (result.success) {
        setFriendRequests(prev => 
          prev.filter(req => req.id !== requestId)
        );
        if (response === 'accepted') {
          loadFriends();
        }
      }
    });
  };

  // Invite friend to game
  const inviteFriend = (friendUid) => {
    socket.emit('invite_friend_to_game', { 
      friendUid 
    }, (response) => {
      if (response.success) {
        alert('Invitation sent!');
      }
    });
  };

  // Load friends and requests
  const loadFriends = async () => {
    socket.emit('get_friends', (friends) => {
      setFriends(friends);
    });
  };

  const loadFriendRequests = async () => {
    socket.emit('get_friend_requests', (requests) => {
      setFriendRequests(requests);
    });
  };

  // Listen for friend-related events
  useEffect(() => {
    socket.on('friend_request_received', (data) => {
      setFriendRequests(prev => [...prev, data]);
      alert(`Friend request received from ${data.senderNickname}`);
    });

    socket.on('friend_invitation_received', (data) => {
      if (window.confirm(`${data.senderNickname} invited you to play! Join game?`)) {
        socket.emit('accept_game_invitation', { invitationId: data.invitationId });
      }
    });

    loadFriends();
    loadFriendRequests();

    return () => {
      socket.off('friend_request_received');
      socket.off('friend_invitation_received');
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="friend-system-overlay">
      <div className="friend-system-modal">
        <div className="friend-system-header">
          <h2>Friends</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="friend-tabs">
          <button 
            className={activeTab === 'search' ? 'active' : ''}
            onClick={() => setActiveTab('search')}
          >
            Find Friends
          </button>
          <button 
            className={activeTab === 'requests' ? 'active' : ''}
            onClick={() => setActiveTab('requests')}
          >
            Requests ({friendRequests.length})
          </button>
          <button 
            className={activeTab === 'friends' ? 'active' : ''}
            onClick={() => setActiveTab('friends')}
          >
            My Friends ({friends.length})
          </button>
        </div>

        <div className="friend-content">
          {activeTab === 'search' && (
            <div className="search-tab">
              <div className="search-input">
                <input
                  type="text"
                  placeholder="Search by nickname"
                  value={searchNickname}
                  onChange={(e) => setSearchNickname(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                />
                <button onClick={searchUsers}>Search</button>
              </div>
              
              <div className="search-results">
                {searchResults.map(user => (
                  <div key={user.uid} className="user-item">
                    <span>{user.nickname}</span>
                    <button onClick={() => sendFriendRequest(user.uid)}>
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="requests-tab">
              {friendRequests.length === 0 ? (
                <p>No pending requests</p>
              ) : (
                friendRequests.map(request => (
                  <div key={request.id} className="request-item">
                    <span>{request.senderNickname} wants to be friends</span>
                    <div>
                      <button 
                        onClick={() => respondToRequest(request.id, 'accepted')}
                        className="accept-btn"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => respondToRequest(request.id, 'declined')}
                        className="decline-btn"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="friends-tab">
              {friends.length === 0 ? (
                <p>No friends yet</p>
              ) : (
                // … inside FriendSystem’s return, in the `friends.map` section:
                friends.map(friend => (
                  <div key={friend.uid} className="friend-item">
                    <span className={`status-dot ${friend.isOnline ? 'online' : 'offline'}`}></span>
                    <span>{friend.nickname}</span>
                    <button onClick={() => inviteFriend(friend.uid)}>
                      Invite to Game
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}