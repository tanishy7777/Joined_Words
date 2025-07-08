import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';
import { ToastContainer, Bounce, toast } from 'react-toastify';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { socket, updateSocketAuth } from './socket';

import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import NicknamePrompt from './components/NicknamePrompt';
import { use } from 'react';



function RoomHandler( { leaderboardData }) {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [isRoomAdmin, setIsRoomAdmin] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    
    useEffect(() => {
        if (!user || !roomCode) {
          console.error("%c[C->S] User or roomCode not available, cannot join room",
          "color: red; font-weight: bold;");
          navigate('/');
          return;
        }

        const doJoin = () => {
            console.log("%c[C→S] SINGLE EMIT: Emitting join_room for", "color: blue; font-weight: bold;", roomCode);
            socket.emit('join_room', roomCode, (response) => {
                if (response.success) {
                    socket.emit('get_room_info', roomCode, ({ isAdmin, gameStarted }) => {
                        setIsRoomAdmin(!!isAdmin);
                        setGameStarted(!!gameStarted);
                    });
                } else {
                    alert('Failed to join room.');
                    let err = response.reason === 'ROOM_NOT_FOUND'
                      ? 'Room not found!'
                      : response.reason === 'PRIVATE_GAME'
                        ? 'This game is private'
                        : 'Join failed';
                    alert(err);
                    navigate('/');
                }
            });
        };

        if (socket.connected) {
            doJoin();
        } else {
            socket.once('connect', doJoin);
        }

        socket.emit('get_leaderboard', roomCode);
        
        return () => {
            socket.off('connect', doJoin);
            return () => {
              socket.off('connect', doJoin);
            };
        };
    }, [user, roomCode, navigate]);

    useEffect(() => {
        const handleGameStart = () => setGameStarted(true);
        socket.on('load_game_component', handleGameStart);
        return () => {
            socket.off('load_game_component', handleGameStart);
        };
    }, [user, roomCode]);

    useEffect(() => {
      socket.on('player_disconnected', (data) => {
        console.log(`${data.nickname} left the game`);
        toast.info("You are now the admin!", {
          position: "bottom-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      });
      
      socket.on('became_admin', () => {
        setIsRoomAdmin(true);
        toast.info("You are now the admin!", {
          position: "bottom-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
        socket.emit('get_leaderboard', roomId);
        console.log("You are now the admin!");
      });

      return () => {
        socket.off('player_disconnected');
        socket.off('became_admin');
      };
    }, []);

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
          <Game roomId={roomCode} socket={socket} players={leaderboardData} />
        )}
      </>
    );
}


function AppContent() {
  const { user, loading, showNicknamePrompt } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState({});
  const [RoomButtonPressed, setRoomButtonPressed] = useState(false);
  
  // (S->C) Update Leaderboard with Data, when server emits 'update_leaderboard'
  useEffect(() => {
    const handleUpdate = (players) => setLeaderboardData(players);
    socket.on('update_leaderboard', handleUpdate);
    return () => {
      console.log(
        "%c[S->C] Unmounted: listening for leaderboard data",
        "color: red; font-weight: bold;"
      );
      socket.off('update_leaderboard', handleUpdate);
    };
  }, []);


  useEffect(() => {
    const handleAuthChange = async () => {
      await updateSocketAuth();
    };

    if (user) handleAuthChange();
  }, [user]);

  const joinRoom = (navigate, formData) => {
      if (!user) return;
      if (RoomButtonPressed) return;
      setRoomButtonPressed(true);
      const roomField = formData.get("roomId");
      if (roomField) {
        setRoomButtonPressed(false);
        navigate(`/room/${roomField}`);
      }
  };

    const joinRandomRoom = (navigate) => {
        if (!user || RoomButtonPressed) return;
        setRoomButtonPressed(true);
        socket.emit('join_random_room', (response) => {
            setRoomButtonPressed(false);
            if (response.success) {
                // The ONLY thing it does on success is navigate.
                navigate(`/room/${response.roomId}`);
            } else {
                alert('No public rooms available.');
            }
        });
    };

    const createRoom = (navigate) => {
        if (!user || RoomButtonPressed) return;
        setRoomButtonPressed(true);
        socket.emit('create_room', (response) => {
            setRoomButtonPressed(false);
            if (response.success) {
                // Navigate on success.
                navigate(`/room/${response.roomId}`);
            } else {
                alert('Failed to create room');
            }
        });
    };


  function ShowRoomButtons() {
    const navigate = useNavigate();
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-lg p-6 space-y-6">
        <button
          onClick={() => joinRandomRoom(navigate)}
          className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Join Random Room
        </button>

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



  if (loading) return <div>Loading…</div>;
  if (showNicknamePrompt) return <NicknamePrompt />;

  return (
    <Router>
      <div className="main-content">
        <ToastContainer
          position="top-center"
          autoClose={500}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover={false}
          theme="colored"
          transition={Bounce}
          />
        <Routes>
          <Route path="/" element={<ShowRoomButtons />} />
          <Route path="/room/:roomCode" element={
            <>
              <RoomHandler leaderboardData={leaderboardData} />
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
