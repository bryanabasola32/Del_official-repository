'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AuroraBackground } from '@/components/auth/AuroraBackground';

const LOGO_SRC = '/del-logo.png';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      router.replace('/command-center');
    }
  };

  return (
    <div className="auth-root">
      <AuroraBackground videoSrc="/aurora-loop.mp4" posterSrc="/aurora-poster.webp" />
      <div className="auth-container">
        <div className="auth-header">
          <img src={LOGO_SRC} alt="DEL" className="auth-logo auth-logo-float" />
          <h1 className="auth-title">Welcome to DEL</h1>
          <p className="auth-subtitle">Sign in to your executive intelligence workspace</p>
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
              <div className="auth-field-row">
                <label className="auth-label" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="auth-link auth-link-xs">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button auth-button-primary auth-button-block" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="auth-footnote">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="auth-link auth-link-strong">
            Create one
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
