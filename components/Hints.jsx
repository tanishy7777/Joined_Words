export default function Hints(props){

    const handleL1Click = () => {
        console.log("L1 button clicked");
        props.socket.emit("hint_l1_clicked", props.roomId);
    };

    const handleN1Click = () => {
        console.log("N1 button clicked");
        props.socket.emit("hint_n1_clicked", props.roomId);
    };

    const handleL2Click = () => {
        console.log("L2 button clicked");
        props.socket.emit("hint_l2_clicked", props.roomId);
    };

    const handleN2Click = () => {
        console.log("N2 button clicked");
        props.socket.emit("hint_n2_clicked", props.roomId);
    };

    // validate if enough hints are available etc, on server side coz gamestate is there
    console.log("Room ID", props.roomId);   
    return (
        <div className="hint-div">
            <div>
                <button onClick={handleL1Click} className="hint-l1-btn">L1</button>
                <button onClick={handleN1Click} className="hint-n1-btn">N1</button>
            </div>
            <div>
                <button onClick={handleL2Click} className="hint-l2-btn">L2</button>
                <button onClick={handleN2Click} className="hint-n2-btn">N2</button>
            </div>
        </div>
    );
}