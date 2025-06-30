import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { socket } from '../socket';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function FriendSystem({ isOpen, onClose, currentRoomId }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [searchNickname, setSearchNickname] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);

  // ⬇️ ADDED: State for custom invite modal
  const [incomingInvite, setIncomingInvite] = useState(null);

  // Search for users by nickname
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

  // Send friend request
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

  // Determine if invite button should be visible
  const canInviteFriends = currentRoomId !== null;

  const inviteFriend = (friendUid) => {
    if (!canInviteFriends) {
      alert('You must be in a game to invite friends!');
      return;
    }
    
    socket.emit('invite_friend_to_game', { friendUid }, (response) => {
      if (response.success) {
        alert('Invitation sent!');
      } else {
        let message = 'Failed to send invitation';
        if (response.reason === 'NOT_IN_GAME') {
          message = 'You must be in a game to invite friends!';
        } else if (response.reason === 'FRIEND_OFFLINE') {
          message = 'Friend is currently offline';
        }
        alert(message);
      }
    });
  };

  const getStatusIcon = (friend) => {
    switch (friend.gameStatus) {
      case 'in_game':
        return <span className="status-dot in-game" title="In Game"></span>;
      case 'online':
        return <span className="status-dot online" title="Online"></span>;
      default:
        return <span className="status-dot offline" title="Offline"></span>;
    }
  };

  // ⬇️ MODIFIED: Listen for invites and show a custom modal/toast instead of window.confirm
  // ⬇️ NOTE: You can use a custom modal (like below) or react-toastify (commented out)
  useEffect(() => {
    const handleInvite = (data) => {
      console.log('Received invite:', data);
      // ⬇️ Option 1: Use a custom modal (set state to show invite)
    //   setIncomingInvite(data);
      // ⬇️ Option 2: Use react-toastify (uncomment below)
      
      toast.info(
        <div>
          <p>{data.senderNickname} invited you to join their game!</p>
          <button onClick={() => {
            socket.emit('accept_game_invitation', { invitationId: data.invitationId }, (response) => {
              if (response.success) {
                window.location.href = `/room/${response.roomId}`;
              } else {
                alert('Failed to join game: ' + response.reason);
              }
            });
            toast.dismiss();
          }}>
            Accept
          </button>
          <button onClick={() => toast.dismiss()}>
            Decline
          </button>
        </div>,
        { autoClose: false }
      );
      
    };
    socket.on('friend_invitation_received', handleInvite);
    return () => {
      socket.off('friend_invitation_received', handleInvite);
    };
  }, []);

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

    loadFriends();
    loadFriendRequests();

    return () => {
      socket.off('friend_request_received');
    };
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* ⬇️ ADDED: Custom invite modal */}
      {incomingInvite && (
        <div className="invite-modal">
          <div className="invite-content">
            <p>{incomingInvite.senderNickname} invited you to join their game!</p>
            <div>
              <button onClick={() => {
                socket.emit('accept_game_invitation', { invitationId: incomingInvite.invitationId }, (response) => {
                  if (response.success) {
                    window.location.href = `/room/${response.roomId}`;
                  } else {
                    alert('Failed to join game: ' + response.reason);
                  }
                });
                setIncomingInvite(null);
              }}>
                Accept
              </button>
              <button onClick={() => setIncomingInvite(null)}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

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
                  friends.map(friend => (
                    <div key={friend.uid} className="friend-item">
                      {getStatusIcon(friend)}
                      <span className="friend-nickname">{friend.nickname}</span>
                      <span className="friend-status">
                        {friend.gameStatus === 'in_game' ? 'Playing' : 
                         friend.gameStatus === 'online' ? 'Online' : 'Offline'}
                      </span>
                      {canInviteFriends && friend.isOnline && (
                        <button 
                          onClick={() => inviteFriend(friend.uid)}
                          className="invite-btn"
                        >
                          Invite to Game
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ⬇️ ADDED: Toast container (if using react-toastify, uncomment this and the toast code above) */}
      <ToastContainer />
    </>
  );
}
