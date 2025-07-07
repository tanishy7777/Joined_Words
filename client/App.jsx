import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { socket, updateSocketAuth } from './socket';

import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import NicknamePrompt from './components/NicknamePrompt';


function AppContent() {
  const { user, loading, showNicknamePrompt } = useAuth();
  const [roomId, setRoomId] = useState(null);
  const [isRoomAdmin, setIsRoomAdmin] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState({});
  
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

  // useEffect(() => {
  //   if (!user || !roomId) return;

  //   socket.emit('join_room', roomId, (res) => {
  //     if (res.success) {
  //       // Fetch room info (like isAdmin) after successful join
  //       socket.emit('get_room_info', roomId, ({ isAdmin }) => {
  //         setIsRoomAdmin(!!isAdmin);
  //       });
  //     }
  //   });
  // }, [user, roomId]);

  // Fixed room creation
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
        socket.emit('get_room_info', response.roomId, ({ isAdmin, gameStarted }) => {
          setIsRoomAdmin(!!isAdmin);
          setGameStarted(!!gameStarted);
        });
        console.log(
          "%c[C->S] Joined random room with ID: {response.roomId}",
          "color: green; font-weight: bold;", response.roomId
        );
      } else alert('No public rooms available. Please create a new room.');
    });
  };

  const joinRoom = (navigate, formData) => {
    if (!user) return;
    const roomField = formData.get("roomId");
    if (roomField) {
      socket.emit('join_room', roomField, (response) => {
        if (response.success) {
          setRoomId(roomField);
          navigate(`/room/${roomField}`);
          socket.emit('get_room_info', roomField, ({ isAdmin, gameStarted }) => {
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
    }
  };

  function RoomHandler() {
    const { roomCode } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
      if (!roomCode || !user) return;

      const joinRoomFromURL = () => {
        console.log(
          "%c[C->S] Joining room with code: {roomCode}",
          "color: green; font-weight: bold;", roomCode
        );
        socket.emit('join_room', roomCode, (res) => {
          if (res.success) {
            setRoomId(roomCode);
            socket.emit('get_room_info', roomCode, ({ isAdmin, gameStarted }) => {
              console.log(
                "%c[C->S] Room info fetched for room code: {roomCode}",
                "color: green; font-weight: bold;", roomCode, isAdmin, gameStarted
              );
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
    if (!roomCode) return <div>Joining room...</div>;

    return (
      <>
        {!gameStarted ? (
          <WaitScreen 
            isRoomAdmin={isRoomAdmin} 
            roomId={roomCode} 
            socket={socket}
            players={leaderboardData}
          />
        ) : (
          <Game roomId={roomCode} socket={socket}/>
        )}
      </>
    );
  }

  function HandleRoom() {
    const navigate = useNavigate();
    return (
      // <div className='room-div'>
      //   <button id='join-random-btn' onClick={() => joinRandomRoom(navigate)}>
      //     Join Random Room
      //   </button>
        
      //   <form onSubmit={(e) => {
      //     e.preventDefault();
      //     joinRoom(navigate, new FormData(e.target));
      //   }}>
      //     <input id='room-id-input' type="text" name="roomId" placeholder="Enter Room ID"/>
      //     <button id="join-room-btn">Join Room</button>
      //   </form>
        
      //   <button id='create-room-btn' onClick={() => createRoom(navigate)}>
      //     Create Room
      //   </button>
      // </div>
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-lg p-6 space-y-6">
        {/* Join Random */}
        <button
          onClick={() => joinRandomRoom(navigate)}
          className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Join Random Room
        </button>

        {/* Join by Code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            joinRoom(navigate, new FormData(e.target));
          }}
          className="flex space-x-2"
        >
          <input
            name="roomId"
            type="text"
            placeholder="Enter Room ID"
            className="flex-1 px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="bg-blue-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Join
          </button>
        </form>

        {/* Create New */}
        <button
          onClick={() => createRoom(navigate)}
          className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Create Room
        </button>
      </div>
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
      <div className="main-content">
        <Routes>
          <Route path="/" element={<HandleRoom />} />
          <Route path="/room/:roomCode" element={
            <>
              <RoomHandler />
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
