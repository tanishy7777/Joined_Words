import React from 'react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

export default function RoomId(props) {

    return (
        <div className="flex items-center space-x-2">
            <p className="text-white-900 font-medium"><span className="font-mono">{props.roomId}</span></p>
            
        </div>
    );
}