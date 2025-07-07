import React from 'react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import ConfigOptions from './ConfigOptions';
import RoomId from './RoomId';
import { useAuth } from '../src/contexts/AuthContext';

export default function WaitScreen(props) {
  const { isRoomAdmin, roomId, socket, players } = props;
  const { user } = useAuth();

  const copyRoomId = () => {
    let copyText = `http://localhost:5173/room/${roomId}`;
    navigator.clipboard.writeText(copyText);
    // TODO: fire a toast/tooltip to confirm copy
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-800 text-white flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">Room ID:</span>
            <RoomId roomId={roomId} className="font-mono tracking-wide" />
          </div>
          <button
            onClick={copyRoomId}
            aria-label="Copy Room ID"
            className="p-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <ClipboardDocumentIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Waiting Message */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-blue-900">
              Waiting for game to start…
            </h2>
            <p className="mt-2 text-sm text-blue-700 italic">
              How to play?
            </p>
            <p className="mt-1 text-blue-800">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit...
            </p>
          </div>

          {/* Config Panel (admins only) */}
          {isRoomAdmin && (
            <ConfigOptions {...props} />
          )}

          {/* Players List */}
          <div>
            <h4 className="text-blue-900 font-medium mb-3">Players Joined</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {players && Object.entries(players).map(([uid, p]) => (
                <div
                  key={uid}
                  className="flex items-center space-x-2 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2"
                >
                  <div className="h-8 w-8 bg-blue-300 text-blue-800 rounded-full flex items-center justify-center font-semibold">
                    {p.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-blue-900">{p.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
