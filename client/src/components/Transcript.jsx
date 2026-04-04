import { useEffect, useRef } from 'react';
import './Transcript.css';

export default function Transcript({ messages }) {
  const bottomRef = useRef(null);

  // Автоскролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="transcript">
      {messages.map((msg) => (
        <div
          key={msg.itemId}
          className={`msg ${msg.role === 'user' ? 'msg-user' : 'msg-ai'}`}
        >
          <div className="msg-bubble">
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
