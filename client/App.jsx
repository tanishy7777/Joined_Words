import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import NicknamePrompt from './components/NicknamePrompt';
import { socket, updateSocketAuth } from './socket'; // Import update function
import FriendSystem from './components/FriendSystem';

function AppContent() {
  const { user, loading, showNicknamePrompt } = useAuth();
  const [roomId, setRoomId] = React.useState(null);
  const [isRoomAdmin, setIsRoomAdmin] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [friendsOpen, setFriendsOpen] = React.useState(false);
  // Handle socket authentication when user changes


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
    const { user } = useAuth();
    let navigate = useNavigate();
    const { roomCode } = useParams();
    const [gameStarted, setGameStarted] = useState(false);

    useEffect(() => {
        if (!roomCode || !user) return;

        const onConnect = () => {
        socket.emit('join_room', roomCode, (res) => {
            if (res.success) {
            setRoomId(roomCode);
            socket.emit('get_room_info', roomCode, ({ isAdmin, gameStarted }) => {
                setIsRoomAdmin(!!isAdmin);
                if (gameStarted) {
                setGameStarted(true);
                }
            });
            navigate(`/room/${roomCode}`);
            } else {
            alert('Failed to join room');
            }
        });
        };

        if (socket.connected) {
        onConnect();
        } else {
        socket.once('connect', onConnect);
        }

        socket.on('load_game_component', () => {
        setGameStarted(true);
        });

        return () => {
        socket.off('connect', onConnect);
        socket.off('load_game_component');
        };
    }, [roomCode, user]);

    return (
        <>
        {roomId && !gameStarted && <WaitScreen isRoomAdmin={isRoomAdmin} roomId={roomId} socket={socket}/>}
        {roomId && gameStarted && <Game roomId={roomId} socket={socket}/>}
        </>
    );
}

  

  useEffect(() => {
    socket.on('load_game_component', () => {
      setGameStarted(true);
    });
    
    return () => {
      socket.off('load_game_component');
    };
  }, []);

   // Show loading or nickname prompt
  if (loading) return <div>Loading…</div>;
  if (showNicknamePrompt) return <NicknamePrompt />;

  return (
    <Router>
      <header className="app-header">
        <button onClick={() => setFriendsOpen(true)}>Friends</button>
      </header>

      <FriendSystem isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} />

      <Routes>
        <Route path="/" element={<HandleRoom />} />
        <Route path="/room/:roomCode" element={<RoomHandler />} />
      </Routes>
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
