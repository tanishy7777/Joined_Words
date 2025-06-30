import React, { useEffect } from 'react';
import io from 'socket.io-client';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router';
import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import { socket } from './socket';

export default function App() {

    const [roomId, setRoomId] = React.useState(null);
    const [isRoomAdmin, setIsRoomAdmin] = React.useState(false);
    const [gameStarted, setGameStarted] = React.useState(false);

    
    const createRoom = (navigate) => {
        // handle room id generation on ser
        setIsRoomAdmin(true);
        socket.emit('create_room', (room) => {
            setRoomId(room);
            navigate(`/room/${room}`);
        });
    }

    const joinRandomRoom = (navigate) => {
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

        

    function HandleRoom(){
        let navigate = useNavigate();
        
        return (
            <>
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
                            
                            <input id='room-id-input' type="text" name="roomId"/>
                            <button id="join-room-btn">Join Room</button>
                        </form>
                    </div>
                    <p>OR</p>
                    <button id='create-room-btn' onClick={() => createRoom(navigate)}>Create Room</button>
                </div>
            </>
        )
    }

    useEffect(() => {
        socket.on('load_game_component', () => {
            setGameStarted(true);
        });
        
        return () => {
            socket.off('load_game_component');
        }
    }, []);

    function RoomHandler(){
        let navigate = useNavigate();
        const { roomCode } = useParams(); 

        useEffect(() => {
            if (roomCode) {
                setRoomId(roomCode);
                console.log("Joining room:", roomCode);
                socket.emit("join_room", roomCode);
                navigate(`/room/${roomCode}`);
            }
        }, [roomCode]);

        return (
            <>
                {/* mount after room is created */}
                {roomId && !gameStarted && <WaitScreen isRoomAdmin={isRoomAdmin} roomId={roomId} socket={socket}/>}
                {/* mount Game component after waiting screen*/}
                {gameStarted && <Game roomId={roomId} socket={socket}/>}
            </>
        )
    }


    return (
        <>
            <Router>
                <Routes>
                    <Route
                    path="/"
                    element={!roomId ? <HandleRoom /> : null}
                    />

                    <Route 
                    path="/room/:roomCode" 
                    element={<RoomHandler />} 
                    />
                </Routes>
            </Router>
        </>
    )
}