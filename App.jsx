import React, { useEffect } from 'react';
import Call from './Call';
import io from 'socket.io-client';
import Game from './components/Game';
import WaitScreen from './components/WaitScreen';
import { socket } from './socket';

export default function App() {

    const [roomId, setRoomId] = React.useState(null);
    const [isRoomAdmin, setIsRoomAdmin] = React.useState(false);
    const [gameStarted, setGameStarted] = React.useState(false);


    function joinRoom(formData){
        const room = formData.get("roomId");
        if(room){
            setRoomId(room);
            console.log('Room joined:', room);
            socket.emit('join_room', room);
        }
    }

    const createRoom = () => {
        let room = Math.random().toString(36).substring(7);
        setIsRoomAdmin(true);
        setRoomId(room);
        console.log("created room:", room);
        socket.emit('create_room', room);
    }



    function HandleRoom(){
        return (
            <>
                <form action={joinRoom}>
                    <input type="text" name="roomId"/>
                    <button id="join_room">Join Room</button>
                </form>            
                <button onClick={createRoom}>Create Room</button>
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


    
    

    return (
        <>
             {!roomId ? <HandleRoom /> : null}
             {/* mount after room is created */}
             {roomId && !gameStarted && <WaitScreen isRoomAdmin={isRoomAdmin} roomId={roomId} socket={socket}/>}
             {/* mount Game component after waiting screen*/}
             {gameStarted && <Game roomId={roomId} socket={socket}/>}
        </>

    )
}