import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { socket, updateSocketAuth } from './socket';

import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import NicknamePrompt from './components/NicknamePrompt';
import FriendSystem from './components/FriendSystem';
import ChatWindow from './components/ChatWindow';


function AppContent() {
  const { user, loading, showNicknamePrompt } = useAuth();
  const [roomId, setRoomId] = useState(null);
  const [isRoomAdmin, setIsRoomAdmin] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState({});
  
  const hasJoinedRef = useRef(false); // on reload this is set to false always

  // (S->C) Update Leaderboard with Data, when server emits 'update_leaderboard'
  useEffect(() => {
    const handleUpdate = (players) => setLeaderboardData(players);
    socket.on('update_leaderboard', handleUpdate);
    
    console.log(
      "%c[S->C] Updated leaderboard data:",
      "color: green; font-weight: bold;",
      leaderboardData
    );

    return () => {
      socket.off('update_leaderboard', handleUpdate);
    };
  }, []);

  // (C->S) Fetch leaderboard data when **roomId changes**
  useEffect(() => {
    if (roomId) {
      console.log(
        "%c[C->S] Fetching leaderboard data for room ID: {roomId}",
        "color: green; font-weight: bold;", roomId
      );

      socket.emit('get_leaderboard', roomId);
    }
  }, [roomId]);

  // Update socket auth on **user changes**
  useEffect(() => {
    const handleAuthChange = async () => {
      await updateSocketAuth();
    };

    if (user) handleAuthChange();
  }, [user]);



  useEffect(() => {
    if (!user || !roomId || hasJoinedRef.current) return;

    socket.emit('join_room', roomId, (res) => {
      if (res.success) {
        hasJoinedRef.current = true;

        // Fetch room info (like isAdmin) after successful join
        socket.emit('get_room_info', roomId, ({ isAdmin }) => {
          setIsRoomAdmin(!!isAdmin);
        });
      }
    });
  }, [user, roomId]);

  // Fixed room creation
  const createRoom = (navigate) => {
    if (!user) return;
    setIsRoomAdmin(true);
    socket.emit('create_room', (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        hasJoinedRef.current = true;
        navigate(`/room/${response.roomId}`);
      } else {
        alert('Failed to create room');
      }
    });
  };

  // Fixed room joining
  const joinRoomCommon = (navigate, roomId) => {
    socket.emit('join_room', roomId, (response) => {
      if (response.success) {
        setRoomId(roomId);
        hasJoinedRef.current = true;
        navigate(`/room/${roomId}`);
        socket.emit('get_room_info', roomId, ({ isAdmin, gameStarted }) => {
          setIsRoomAdmin(!!isAdmin);
          setGameStarted(!!gameStarted);
        });
      } else {
        let errorMessage = "Join failed";
        if (response.reason === 'ROOM_NOT_FOUND') errorMessage = "Room not found!";
        else if (response.reason === 'PRIVATE_GAME') errorMessage = "This game is private";
        alert(errorMessage);
      }
    });
  };

  const joinRandomRoom = (navigate) => {
    if (!user) return;
    socket.emit('join_random_room', (response) => {
      if (response.success) joinRoomCommon(navigate, response.roomId);
      else alert('No public rooms available. Please create a new room.');
    });
  };

  const joinRoom = (navigate, formData) => {
    if (!user) return;
    const room = formData.get("roomId");
    if (room) joinRoomCommon(navigate, room);
  };

  function RoomHandler() {
    const { roomCode } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
      if (!roomCode || !user || hasJoinedRef.current) return;

      const joinRoomFromURL = () => {
        socket.emit('join_room', roomCode, (res) => {
          if (res.success) {
            setRoomId(roomCode);
            hasJoinedRef.current = true;
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

      if (socket.connected) joinRoomFromURL();
      else socket.once('connect', joinRoomFromURL);

      const handleGameStart = () => setGameStarted(true);
      socket.on('load_game_component', handleGameStart);

      return () => {
        socket.off('connect', joinRoomFromURL);
        socket.off('load_game_component', handleGameStart);
      };
    }, [roomCode, user, navigate]);

    if (!user || loading) return <div>Loading...</div>;
    if (!roomId || roomId !== roomCode) return <div>Joining room...</div>;

    return (
      <>
        {!gameStarted ? (
          <WaitScreen 
            isRoomAdmin={isRoomAdmin} 
            roomId={roomId} 
            socket={socket}
            players={leaderboardData}
          />
        ) : (
          <Game roomId={roomId} socket={socket}/>
        )}
      </>
    );
  }

  function HandleRoom() {
    const navigate = useNavigate();
    return (
      <div className='room-div'>
        <button id='join-random-btn' onClick={() => joinRandomRoom(navigate)}>
          Join Random Room
        </button>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          joinRoom(navigate, new FormData(e.target));
        }}>
          <input id='room-id-input' type="text" name="roomId" placeholder="Enter Room ID"/>
          <button id="join-room-btn">Join Room</button>
        </form>
        
        <button id='create-room-btn' onClick={() => createRoom(navigate)}>
          Create Room
        </button>
      </div>
    );
  }

  useEffect(() => {
    socket.on('player_disconnected', (data) => {
      console.log(`${data.nickname} left the game`);
    });
    
    socket.on('became_admin', () => {
      setIsRoomAdmin(true);
      console.log("You are now the admin!");
    });

    return () => {
      socket.off('player_disconnected');
      socket.off('became_admin');
    };
  }, []);

  if (loading) return <div>Loading…</div>;
  if (showNicknamePrompt) return <NicknamePrompt />;

  return (
    <Router>
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
              {roomId && <ChatWindow roomId={roomId} className={gameStarted ? 'game-chat' : 'wait-chat'} />}
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
