'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { AuroraBackground } from '@/components/auth/AuroraBackground';

const LOGO_SRC = '/del-logo.png';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="auth-root">
        <AuroraBackground videoSrc="/aurora-loop.mp4" posterSrc="/aurora-poster.webp" />
        <div className="auth-container">
          <div className="auth-glass-card">
            <div className="auth-state">
              <MailCheck className="auth-state-icon" />
              <h1 className="auth-state-title">Check Your Email</h1>
              <p className="auth-state-body">
                We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
              </p>
              <div className="auth-state-link">
                <Link href="/login" className="auth-link auth-link-inline">
                  <ArrowLeft className="auth-icon-xs" />
                  Back to sign in
                </Link>
              </div>
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
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

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-button auth-button-primary auth-button-block" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>

        <p className="auth-footnote auth-footnote-spaced">
          <Link href="/login" className="auth-link auth-link-xs auth-link-inline">
            <ArrowLeft className="auth-icon-xs" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
