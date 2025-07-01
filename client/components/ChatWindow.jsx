// src/components/ChatWindow.jsx
import React, { useEffect, useState, useRef, memo } from 'react';
import { socket } from '../socket';
import { useAuth } from '../src/contexts/AuthContext';

const ChatLog = memo(function ChatLog({ messages, currentUid }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  return (
    <div className="chat-log">
      {messages.map((m, i) => (
        <div key={i}
             className={`bubble ${
               m.type === 'system' ? 'system'
               : m.uid === currentUid ? 'me'
               : 'them'}`}>
          {m.type === 'system'
            ? <em>{m.text}</em>
            : <>
                <span className="nick">{m.nickname}</span>
                <span>{m.text}</span>
              </>
          }
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
});

export default function ChatWindow({ roomId, className = '' }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState('');

  // Receive messages
  useEffect(() => {
    const handler = (msg) => setMessages(msgs => [...msgs, msg]);
    socket.on('chat_message', handler);
    return () => { socket.off('chat_message', handler); };
  }, []);

  // Send message without remounting input
  const send = e => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('chat_message', { roomId, text: input.trim() });
    setInput('');
  };

  return (
    <div className={`chat-window ${className}`}>
      <ChatLog messages={messages} currentUid={user?.uid} />
      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
        />
      </form>
    </div>
  );
}
