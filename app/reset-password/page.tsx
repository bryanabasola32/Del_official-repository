'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { AuroraBackground } from '@/components/auth/AuroraBackground';

const LOGO_SRC = '/del-logo.png';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // user arrived via reset link
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace('/command-center'), 1500);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="auth-root">
        <AuroraBackground videoSrc="/aurora-loop.mp4" posterSrc="/aurora-poster.webp" />
        <div className="auth-container">
          <div className="auth-glass-card">
            <div className="auth-state">
              <CheckCircle2 className="auth-state-icon" />
              <h1 className="auth-state-title">Password Updated</h1>
              <p className="auth-state-body">Redirecting to your workspace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <AuroraBackground videoSrc="/aurora-loop.mp4" posterSrc="/aurora-poster.webp" />
      <div className="auth-container">
        <div className="auth-header">
          <img src={LOGO_SRC} alt="DEL" className="auth-logo auth-logo-float" />
          <h1 className="auth-title">Set New Password</h1>
        </div>

        <div className="auth-glass-card">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">New Password</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                className="auth-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button auth-button-primary auth-button-block" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        <p className="auth-footnote auth-footnote-spaced">
          <Link href="/login" className="auth-link auth-link-xs">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
