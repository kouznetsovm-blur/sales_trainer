import { useState, useRef, useCallback, useEffect } from 'react';

export function useRealtimeSession() {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [speaking, setSpeaking] = useState('idle'); // 'idle' | 'user' | 'ai'

  const pcRef = useRef(null);       // RTCPeerConnection
  const dcRef = useRef(null);       // DataChannel
  const audioRef = useRef(null);    // Audio element для голоса AI
  const sessionIdRef = useRef(null);
  const pendingMsgRef = useRef({}); // Накапливаем текст до завершения реплики

  // Добавить или обновить сообщение по itemId
  const upsertMessage = useCallback((itemId, role, delta) => {
    setMessages(prev => {
      const existing = prev.find(m => m.itemId === itemId);
      if (existing) {
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

      // Пользователь начал говорить
      case 'input_speech_started':
        setSpeaking('user');
        break;

      // Пользователь замолчал
      case 'input_speech_stopped':
        setSpeaking('idle');
        break;

      // Дельта транскрипта пользователя (реальное время)
      case 'conversation.item.input_audio_transcription.delta':
        upsertMessage(data.item_id, 'user', data.delta || '');
        break;

      // Транскрипт пользователя завершён — сохраняем в БД
      case 'conversation.item.input_audio_transcription.completed': {
        const text = data.transcript?.trim();
        if (text && sessionIdRef.current) {
          fetch('/api/session/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionIdRef.current, role: 'user', text })
          });
        }
        break;
      }

      // AI начал отвечать
      case 'response.created':
        setSpeaking('ai');
        break;

      // Дельта транскрипта AI (реальное время)
      case 'response.audio_transcript.delta':
        upsertMessage(data.item_id, 'assistant', data.delta || '');
        break;

      // Ответ AI завершён — сохраняем в БД
      case 'response.audio_transcript.done': {
        const text = data.transcript?.trim();
        if (text && sessionIdRef.current) {
          fetch('/api/session/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionIdRef.current, role: 'assistant', text })
          });
        }
        setSpeaking('idle');
        break;
      }

      // AI замолчал (ответ завершён или прерван)
      case 'response.done':
        setSpeaking('idle');
        break;

      default:
        break;
    }
  }, [upsertMessage]);

  const startSession = useCallback(async () => {
    try {
      // 1. Получаем ephemeral token с нашего сервера
      const res = await fetch('/api/session/token', { method: 'POST' });
      const { token, sessionId } = await res.json();
      sessionIdRef.current = sessionId;

      // 2. Создаём WebRTC соединение
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. Аудио элемент для воспроизведения голоса AI
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

      // 4. Захватываем микрофон
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 5. Data channel для событий
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = handleEvent;

      // 6. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Отправляем в OpenAI Realtime API
      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-realtime-mini',
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
    // Закрываем WebRTC
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    if (audioRef.current) audioRef.current.srcObject = null;

    pcRef.current = null;
    dcRef.current = null;

    // Завершаем сессию в БД
    if (sessionIdRef.current) {
      fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            [JSON.stringify({ sessionId: sessionIdRef.current })],
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
