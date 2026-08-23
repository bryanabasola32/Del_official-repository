'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { AuroraBackground } from '@/components/auth/AuroraBackground';

const LOGO_SRC = '/del-logo.png';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    const { error } = await signUp(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.replace('/command-center'), 1500);
    }
  };

  if (success) {
    return (
      <div className="auth-root">
        <AuroraBackground videoSrc="/aurora-loop.mp4" posterSrc="/aurora-poster.webp" />
        <div className="auth-container">
          <div className="auth-glass-card">
            <div className="auth-state">
              <CheckCircle2 className="auth-state-icon" />
              <h1 className="auth-state-title">Account Created</h1>
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join DEL to start researching executives</p>
        </div>

        <div className="auth-glass-card">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
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
                placeholder="Re-enter your password"
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button auth-button-primary auth-button-block" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="auth-footnote">
          Already have an account?{' '}
          <Link href="/login" className="auth-link auth-link-strong">
            Sign in
          </Link>
        </p>

        <p className="auth-footnote auth-footnote-spaced">
          <Link href="/" className="auth-link auth-link-xs auth-link-inline">
            <ArrowLeft className="auth-icon-xs" />
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
