'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken, getChatMessages, getChatRoom, sendChatMessage } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';

type ChatMessage = {
  id: string;
  sender_name?: string;
  body: string;
  created_at?: string;
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ParentChatPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const roomKey = 'support';
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setGuest(isGuestMode());
  }, []);

  const loadMessages = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        await getChatRoom(token, roomKey);
        const payload = await getChatMessages(token, roomKey);
        setMessages(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось загрузить чат';
        setError(message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    let mounted = true;
    getAccessToken().then((nextToken) => {
      if (!mounted) return;
      setToken(nextToken || '');
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    loadMessages();
    const timer = window.setInterval(() => loadMessages({ silent: true }), 3500);
    return () => window.clearInterval(timer);
  }, [loadMessages, token]);

  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      ),
    [messages]
  );

  const onSend = async () => {
    const body = text.trim();
    if (!body || sending || !token) return;
    setSending(true);
    setText('');
    setError('');
    try {
      const payload = await sendChatMessage(token, roomKey, body);
      if (payload?.data) setMessages((prev) => [...prev, payload.data]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отправить сообщение';
      setError(message);
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card">
      <div className="requests-head">
        <h2>Чат</h2>
        <button type="button" className="button secondary" onClick={() => loadMessages()}>
          Обновить
        </button>
      </div>
      <p className="muted">Чат поддержки родителя.</p>
      {guest ? (
        <p style={{ color: '#374151', fontWeight: 600 }}>
          В гостевом режиме чат недоступен. Войдите в аккаунт родителя.
        </p>
      ) : null}

      <div
        style={{
          marginTop: 12,
          border: '1px solid rgba(120,106,255,0.18)',
          borderRadius: 14,
          background: '#f8faff',
          minHeight: 320,
          maxHeight: 520,
          overflowY: 'auto',
          padding: 12,
          display: 'grid',
          gap: 8,
        }}
      >
        {loading ? <p className="muted">Загрузка...</p> : null}
        {!loading && !sorted.length ? <p className="muted">Пока нет сообщений.</p> : null}
        {sorted.map((message) => (
          <div
            key={message.id}
            style={{
              borderRadius: 12,
              background: '#fff',
              border: '1px solid rgba(120,106,255,0.16)',
              padding: 10,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, color: '#3f59bd' }}>
              {message.sender_name || 'User'}
            </p>
            <p style={{ margin: '4px 0 0' }}>{message.body}</p>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
              {formatTime(message.created_at)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите сообщение"
          disabled={guest}
        />
        <button type="button" className="button" disabled={guest || !text.trim() || sending} onClick={onSend}>
          {sending ? 'Отправка...' : 'Отправить'}
        </button>
      </div>

      {error ? <p style={{ marginTop: 10, color: '#b91c1c' }}>{error}</p> : null}
    </div>
  );
}
