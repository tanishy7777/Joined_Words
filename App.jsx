import React, { useEffect } from 'react';
import Call from './Call';
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
        let room = Math.random().toString(36).substring(7);
        setIsRoomAdmin(true);
        setRoomId(room);
        console.log("created room:", room);
        socket.emit('create_room', room);
        navigate(`/room/${room}`);
    }
    
    const joinRoom = (navigate, formData) => {
        const room = formData.get("roomId");
        if(room){
            setRoomId(room);
            console.log('Room joined:', room);
            socket.emit('join_room', room);
            navigate(`/room/${room}`);
        }
    }
    

    function HandleRoom(){
        let navigate = useNavigate();
        
        return (
            <>
                <div className='room-div'>
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