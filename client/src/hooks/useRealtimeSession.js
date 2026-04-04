import { useState, useRef, useCallback, useEffect } from 'react';
import { authFetch, getToken } from '../utils/api.js';

export function useRealtimeSession() {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [speaking, setSpeaking] = useState('idle'); // 'idle' | 'user' | 'ai'

  // Фильтр галлюцинаций Whisper
  const isValidTranscript = (text) => {
    if (!text || text.trim().length < 3) return false;
    if (/^[\p{Emoji}\s\p{P}]+$/u.test(text)) return false;
    const hallucinations = [
      'субтитры сделал', 'продолжение следует', 'напряжённая музыка',
      'напряженная музыка', 'тихая музыка', 'музыка играет',
      'www.', 'http', 'copyright'
    ];
    const lower = text.toLowerCase();
    if (hallucinations.some(h => lower.includes(h))) return false;
    return true;
  };

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioRef = useRef(null);
  const sessionIdRef = useRef(null);

  const upsertMessage = useCallback((itemId, role, delta) => {
    setMessages(prev => {
      const existing = prev.find(m => m.itemId === itemId);
      if (existing) {
        if (!delta) return prev;
        return prev.map(m =>
          m.itemId === itemId ? { ...m, text: m.text + delta } : m
        );
      }
      return [...prev, { itemId, role, text: delta }];
    });
  }, []);

  const handleEvent = useCallback((event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'input_speech_started':
        setSpeaking('user');
        break;

      case 'input_speech_stopped':
        setSpeaking('idle');
        break;

      case 'conversation.item.created':
        if (data.item?.role === 'user') {
          upsertMessage(data.item.id, 'user', '');
        }
        break;

      case 'conversation.item.input_audio_transcription.delta':
        upsertMessage(data.item_id, 'user', data.delta || '');
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const text = data.transcript?.trim();
        if (isValidTranscript(text) && sessionIdRef.current) {
          authFetch('/api/session/message', {
            method: 'POST',
            silent: true,
            body: JSON.stringify({ sessionId: sessionIdRef.current, role: 'user', text })
          });
        }
        break;
      }

      case 'response.created':
        setSpeaking('ai');
        break;

      case 'response.audio_transcript.delta':
        upsertMessage(data.item_id, 'assistant', data.delta || '');
        break;

      case 'response.audio_transcript.done':
        setSpeaking('idle');
        break;

      case 'response.done': {
        setSpeaking('idle');
        if (data.response?.status === 'completed' && sessionIdRef.current) {
          const transcript = data.response.output?.[0]?.content?.find(
            c => c.type === 'audio'
          )?.transcript?.trim();
          if (transcript) {
            authFetch('/api/session/message', {
              method: 'POST',
              silent: true,
              body: JSON.stringify({ sessionId: sessionIdRef.current, role: 'assistant', text: transcript })
            });
          }
        }
        break;
      }

      default:
        break;
    }
  }, [upsertMessage]);

  const startSession = useCallback(async (testId) => {
    try {
      const res = await authFetch('/api/session/token', {
        method: 'POST',
        body: JSON.stringify({ testId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Не удалось получить токен:', err.error);
        return;
      }
      const { token, sessionId } = await res.json();
      sessionIdRef.current = sessionId;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = handleEvent;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-realtime',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        }
      );

      const sdpAnswer = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });

      setIsActive(true);
    } catch (err) {
      console.error('Ошибка запуска сессии:', err);
    }
  }, [handleEvent]);

  const stopSession = useCallback(() => {
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    if (audioRef.current) audioRef.current.srcObject = null;

    pcRef.current = null;
    dcRef.current = null;

    if (sessionIdRef.current) {
      authFetch('/api/session/end', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessionIdRef.current })
      });
    }

    setSpeaking('idle');
    setIsActive(false);
  }, []);

  // Автозакрытие сессии при закрытии вкладки
  useEffect(() => {
    const handleUnload = () => {
      if (sessionIdRef.current) {
        navigator.sendBeacon(
          '/api/session/end',
          new Blob(
            [JSON.stringify({ sessionId: sessionIdRef.current, token: getToken() })],
            { type: 'application/json' }
          )
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return { isActive, messages, speaking, startSession, stopSession };
}
