'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/school-info');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/school-info');
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
          <h1 style={{ marginTop: 0 }}>Вход администратора</h1>
          <p className="muted">Используйте тот же логин/пароль, что и в приложении.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="admin@school.kz"
                required
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <div className="input-wrap">
                <input
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="input-eye"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
          <div style={{ marginTop: 16 }}>
            <a className="muted" href="/school-registration">
              Нет аккаунта? Зарегистрироваться
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
