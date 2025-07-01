import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import NicknamePrompt from './components/NicknamePrompt';
import { socket, updateSocketAuth } from './socket'; // Import update function
import FriendSystem from './components/FriendSystem';
import Leaderboard from './components/Leaderboard';
import ChatWindow from './components/ChatWindow';

function AppContent() {
  const { user, loading, showNicknamePrompt } = useAuth();
  const [roomId, setRoomId] = React.useState(null);
  const [isRoomAdmin, setIsRoomAdmin] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  const [leaderboardData, setLeaderboardData] = useState({});  

  // track leaderboard updates
  useEffect(() => {
     const handleUpdate = (players) => {
       setLeaderboardData(players);
     };
     socket.on('update_leaderboard', handleUpdate);
     if (roomId) socket.emit('get_leaderboard', roomId);
     return () => {
       socket.off('update_leaderboard', handleUpdate);
     };
   }, [roomId]);

  useEffect(() => {
    
    const handleAuthChange = async () => {
      await updateSocketAuth();
      
      // Rejoin room if needed
      if (roomId && user) {
        socket.emit('join_room', roomId, (res) => {
          if (res.success) {
            socket.emit('get_room_info', roomId, ({ isAdmin }) => {
              setIsRoomAdmin(!!isAdmin);
            });
          }
        });
      }
    };

    if (user) {
      handleAuthChange();
    }
  }, [user, roomId]);

  const createRoom = (navigate) => {
    if (!user) return;
    setIsRoomAdmin(true);
    socket.emit('create_room', (response) => {
        if (response.success) {
            setRoomId(response.roomId);
            navigate(`/room/${response.roomId}`);
        } else {
            alert('Failed to create room');
        }
    });
};
  
  const joinRandomRoom = (navigate) => {
    if (!user) return;
    socket.emit('join_random_room', (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        navigate(`/room/${response.roomId}`);
      } else {
        alert('No public rooms available. Please create a new room.');
      }
    });
  };

  const joinRoom = (navigate, formData) => {
    if (!user) return;
    const room = formData.get("roomId");
    if (!room) return;

    socket.emit('join_room', room, (response) => {
      if (response.success) {
        setRoomId(room);
        navigate(`/room/${room}`);
      } else {
        let errorMessage = "Join failed";
        if (response.reason === 'ROOM_NOT_FOUND') {
          errorMessage = "Room not found!";
        } else if (response.reason === 'PRIVATE_GAME') {
          errorMessage = "This game is private";
        }
        alert(errorMessage);
      }
    });
  };

  function HandleRoom() {
    let navigate = useNavigate();
    
    return (
      <div className='room-div'>
        <div className='join-random-div'>
          <button id='join-random-btn' onClick={() => joinRandomRoom(navigate)}>
            Join Random Room
          </button>
        </div>
        
        <div className='join-room-div'>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            joinRoom(navigate, formData);
          }}>
            <input id='room-id-input' type="text" name="roomId" placeholder="Enter Room ID"/>
            <button id="join-room-btn">Join Room</button>
          </form>
        </div>
        
        <p>OR</p>
        
        <button id='create-room-btn' onClick={() => createRoom(navigate)}>
          Create Room
        </button>
      </div>
    );
  }

    function RoomHandler() {
      const { roomCode } = useParams();
      const navigate = useNavigate();
      
      useEffect(() => {
        if (!roomCode || !user) return;

        const joinRoomFromURL = () => {
          socket.emit('join_room', roomCode, (res) => {
            if (res.success) {
              setRoomId(roomCode);
              socket.emit('get_room_info', roomCode, ({ isAdmin, gameStarted }) => {
                setIsRoomAdmin(!!isAdmin);
                setGameStarted(!!gameStarted);
              });
            } else {
              alert('Failed to join room. Redirecting to home.');
              navigate('/');
            }
          });
        };

        if (socket.connected) {
          joinRoomFromURL();
        } else {
          socket.once('connect', joinRoomFromURL);
        }

        const handleGameStart = () => {
          setGameStarted(true);
        };

        socket.on('load_game_component', handleGameStart);

        return () => {
          socket.off('connect', joinRoomFromURL);
          socket.off('load_game_component', handleGameStart);
        };
      }, [roomCode, user, navigate]);

      if (!user || loading) {
        return <div>Loading...</div>;
      }

      if (!roomId || roomId !== roomCode) {
        return <div>Joining room...</div>;
      }

      return (
        <>
          {!gameStarted && (
            <WaitScreen 
              isRoomAdmin={isRoomAdmin} 
              roomId={roomId} 
              socket={socket}
              players={leaderboardData}
            />
          )}
          {gameStarted && <Game roomId={roomId} socket={socket}/>}
        </>
    );
  }

  // In your React components
  useEffect(() => {
      socket.on('player_disconnected', (data) => {
          console.log(`${data.nickname} left the game`);
          // You could show a toast notification here
      });
      
      socket.on('became_admin', (data) => {
          setIsRoomAdmin(true);
          console.log("You are now the admin!");
          // Optionally show a toast or UI update here
      });

      socket.on('admin_changed', (data) => {
          console.log(`${data.nickname} is now the admin`);
          // Optionally update UI for all players
      });
      
      return () => {
          socket.off('player_disconnected');
          socket.off('became_admin');
          socket.off('admin_changed');
      };
  }, [socket]);



   // Show loading or nickname prompt
  if (loading) return <div>Loading…</div>;
  if (showNicknamePrompt) return <NicknamePrompt />;

  return (
    <Router>
      {/* Header */}
      <header className="app-header">
        <button onClick={() => setFriendsOpen(true)}>Friends</button>
      </header>

      <FriendSystem isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} />

      <div className="main-content">
        <Routes>
          <Route path="/" element={<HandleRoom />} />
          <Route path="/room/:roomCode" element={
            <>
              <RoomHandler />
              <ChatWindow roomId={roomId} className={gameStarted ? 'game-chat' : 'wait-chat'} />
            </>
          }/>
        </Routes>
      </div>
    </Router>
  );

}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
