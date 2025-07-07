import React from 'react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

export default function RoomId(props) {

    function copyLinkToClipboard(){
        const roomLink = window.location.href;
        navigator.clipboard.writeText(roomLink);
        
    }

    // <button
    //             onClick={copyLinkToClipboard}
    //             className="p-1 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
    //             aria-label="Copy room link">
    //             {/* use whichever Heroicon you prefer */}
    //             <ClipboardDocumentIcon className="h-5 w-5 text-blue-600" />
    //         </button>

    return (
        <div className="flex items-center space-x-2">
            <p className="text-white-900 font-medium"><span className="font-mono">{props.roomId}</span></p>
            
        </div>
    );
}