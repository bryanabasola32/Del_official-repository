import * as React from "react";
import { BadgeCheck, Radar, Workflow } from "lucide-react";

import { AuroraBackground } from "./auth/AuroraBackground";

export interface AuthShellAsset {
  /** Seamless loop video used as the animated background. */
  video: string;
  /** Poster / reduced-motion still. */
  poster?: string;
  /** Brand logo. */
  logo: string;
}

export interface AuthShellProps {
  assets: AuthShellAsset;
  title: string;
  subtitle?: string;
  /** Brand name used for the logo alt text. */
  brand?: string;
  /** Show the three-item value-prop list under the card (login/register only). */
  showFeatureHighlights?: boolean;
  highlights?: Array<{ icon: React.ComponentType<{ className?: string }>; label: string }>;
  children: React.ReactNode;
}

const defaultHighlights = [
  { icon: BadgeCheck, label: "AI-verified executive profiles" },
  { icon: Radar, label: "Real-time intelligence synthesis" },
  { icon: Workflow, label: "Enterprise-grade research automation" },
];

/**
 * Shared chrome for every auth screen: Layer 0 background, floating logo,
 * heading block and the Layer 2 glass card. Success / sent / done states must
 * render inside this shell too, so the background never disappears.
 */
export function AuthShell({
  assets,
  title,
  subtitle,
  brand = "DEL",
  showFeatureHighlights = false,
  highlights = defaultHighlights,
  children,
}: AuthShellProps) {
  return (
    <div className="auth-root">
      <AuroraBackground videoSrc={assets.video} posterSrc={assets.poster} />

      <main className="auth-container">
        <header className="auth-header">
          <img
            src={assets.logo}
            alt={`${brand} logo`}
            width={112}
            height={112}
            className="auth-logo auth-logo-float"
          />
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </header>

        <section className="auth-glass-card">{children}</section>

        {showFeatureHighlights ? (
          <ul className="auth-highlights">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="auth-highlight-icon" />
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
