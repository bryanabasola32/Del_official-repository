'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Settings, Sun, Moon, Monitor, Bell, Shield, Database, Sparkles,
  Search, FileText, Globe, Newspaper, Bot, CheckCircle2, XCircle,
  AlertCircle, Loader2, Activity, Cpu, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { orchestrator } from '@/services/orchestrator';
import { getIntelligenceRouter } from '@/services/router';
import { getProviderConfig } from '@/services/models/ProviderConfig';
import { getEnabledResearchProviderConfigs } from '@/services/models/ResearchProviderConfig';
import type { ProviderInfo } from '@/services/providers/types';

interface DiagnosticsData {
  modelProviders: {
    id: string;
    name: string;
    isMock: boolean;
    enabled: boolean;
    configured: boolean;
    state: string;
    edgeFunctionSlug: string;
  }[];
  researchProviders: {
    id: string;
    name: string;
    enabled: boolean;
    edgeFunctionSlug: string;
    apiKeyEnvVar: string;
  }[];
  legacyProviders: ProviderInfo[];
  routerProviderCount: number;
  routerLogs: { stage: string; level: string; message: string; providerId?: string }[];
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    try {
      orchestrator.ensureProvidersRegistered();
      const router = getIntelligenceRouter();
      const profiles = router.getProviderProfiles();
      const logs = router.getLogs().slice(-10).reverse();

      const modelProviders = profiles.map((p) => {
        const config = getProviderConfig(p.id);
        return {
          id: p.id,
          name: p.name,
          isMock: p.isMock,
          enabled: config?.enabled ?? false,
          configured: true,
          state: 'ACTIVE',
          edgeFunctionSlug: config?.edgeFunctionSlug ?? '',
        };
      });

      const researchProviders = getEnabledResearchProviderConfigs().map((c) => ({
        id: c.id,
        name: c.name,
        enabled: c.enabled,
        edgeFunctionSlug: c.edgeFunctionSlug,
        apiKeyEnvVar: c.apiKeyEnvVar,
      }));

      const legacyProviders = orchestrator.getProviderInfo();

      setDiagnostics({
        modelProviders,
        researchProviders,
        legacyProviders,
        routerProviderCount: router.getProviders().length,
        routerLogs: logs.map((l) => ({ stage: l.stage, level: l.level, message: l.message, providerId: l.providerId })),
      });
    } catch (e) {
      console.error('[Settings] Failed to load diagnostics:', e);
    }
  }, []);

  const activeAIProvider = diagnostics?.modelProviders.find((p) => p.enabled && !p.isMock);
  const activeSearchProvider = diagnostics?.researchProviders.find((p) => p.enabled);
  const hasRealAI = !!activeAIProvider;
  const hasRealSearch = !!activeSearchProvider;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your DEL workspace preferences</p>
      </div>

      {/* Appearance */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sun className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold">Appearance</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Theme</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Choose how DEL looks to you</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ThemeOption icon={Sun} label="Light" active={theme === 'light'} onClick={() => setTheme('light')} />
            <ThemeOption icon={Moon} label="Dark" active={theme === 'dark'} onClick={() => setTheme('dark')} />
            <ThemeOption icon={Monitor} label="System" active={theme === 'system'} onClick={() => setTheme('system')} />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>
        <div className="space-y-4">
          <SettingRow label="Data freshness reminders" description="Get notified when executive intelligence is stale" defaultChecked />
          <SettingRow label="Intelligence completion" description="Notify when AI finishes generating a persona" defaultChecked />
          <SettingRow label="Invitation sent summaries" description="Get a summary when invitations are sent" defaultChecked />
        </div>
      </Card>

      {/* AI Configuration */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold">AI Configuration</h2>
          <Badge className={cn(
            'text-[10px]',
            hasRealAI
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
              : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
          )}>
            {hasRealAI ? 'Live' : 'Mock Mode'}
          </Badge>
        </div>
        <div className="space-y-4">
          {/* AI Provider */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">AI Provider</span>
              <span className="text-xs text-muted-foreground">
                {diagnostics ? (
                  diagnostics.modelProviders
                    .filter((p) => p.enabled)
                    .map((p) => p.name)
                    .join(' → ') || 'None'
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasRealAI
                ? `Router will try providers in order. ${diagnostics?.routerProviderCount ?? 0} providers registered.`
                : 'No AI providers registered. Set API keys in Supabase Edge Function Secrets.'}
            </p>
            {diagnostics?.modelProviders.map((p) => (
              <div key={p.id} className="flex items-center gap-2 mt-2 text-xs">
                {p.enabled ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={p.enabled ? 'text-foreground' : 'text-muted-foreground'}>{p.name}</span>
                <span className="text-muted-foreground">— {p.edgeFunctionSlug}</span>
              </div>
            ))}
          </div>

          {/* Search Provider */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Search Provider</span>
              <span className="text-xs text-muted-foreground">
                {diagnostics ? (
                  diagnostics.researchProviders
                    .filter((p) => p.enabled)
                    .map((p) => p.name)
                    .join(', ') || 'None'
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasRealSearch
                ? 'Web search is active for the research pipeline.'
                : 'No search providers enabled. Set API keys in Supabase Edge Function Secrets.'}
            </p>
            {diagnostics?.researchProviders.map((p) => (
              <div key={p.id} className="flex items-center gap-2 mt-2 text-xs">
                {p.enabled ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={p.enabled ? 'text-foreground' : 'text-muted-foreground'}>{p.name}</span>
                <span className="text-muted-foreground">— {p.edgeFunctionSlug}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Data & Privacy */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold">Data &amp; Privacy</h2>
        </div>
        <div className="space-y-4">
          <SettingRow label="Preserve original client data" description="AI-generated information never overwrites client-provided data" defaultChecked disabled />
          <SettingRow label="Require human approval for invitations" description="AI never sends invitations without explicit user confirmation" defaultChecked disabled />
        </div>
      </Card>

      {/* System */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold">System</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">DEL 1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Database</span>
            <span className="font-medium">Supabase (PostgreSQL)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Architecture</span>
            <span className="font-medium">Provider-based (modular)</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Router Providers</span>
            <span className="font-medium">{diagnostics?.routerProviderCount ?? '—'}</span>
          </div>
        </div>
      </Card>

      {/* Diagnostics Panel */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-sm font-semibold">Diagnostics</h2>
            <Badge variant="outline" className="text-[10px]">Debug</Badge>
          </div>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="text-xs text-primary hover:underline"
          >
            {showDiagnostics ? 'Hide' : 'Show'}
          </button>
        </div>

        {showDiagnostics && diagnostics && (
          <div className="space-y-4">
            {/* AI Model Providers */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Cpu className="h-3 w-3" /> AI Model Providers
              </div>
              <div className="space-y-2">
                {diagnostics.modelProviders.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{p.name}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge className={cn(
                          'text-[9px]',
                          p.enabled
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {!p.isMock && p.enabled && (
                          <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                            Real
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      ID: {p.id} | Edge: {p.edgeFunctionSlug} | State: {p.state}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Research Providers */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Search className="h-3 w-3" /> Research Providers
              </div>
              <div className="space-y-2">
                {diagnostics.researchProviders.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{p.name}</span>
                      <Badge className={cn(
                        'text-[9px]',
                        p.enabled
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {p.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Edge: {p.edgeFunctionSlug} | Key: {p.apiKeyEnvVar}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legacy Provider Registry */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Bot className="h-3 w-3" /> Legacy Provider Registry
              </div>
              <div className="space-y-1">
                {diagnostics.legacyProviders.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="font-medium">{p.implementation}</span>
                    {p.isMock && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">Mock</Badge>}
                  </div>
                ))}
              </div>
            </div>

            {/* Router Logs */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Recent Router Activity
              </div>
              {diagnostics.routerLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No router activity yet. Send a chat message to see logs.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {diagnostics.routerLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      {log.level === 'error' ? (
                        <AlertCircle className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                      ) : log.level === 'warning' ? (
                        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        log.level === 'error' ? 'text-rose-600 dark:text-rose-400' :
                        log.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                        'text-muted-foreground'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!showDiagnostics && (
          <p className="text-xs text-muted-foreground">
            Click "Show" to view provider status, router logs, and configuration details.
          </p>
        )}
      </Card>
    </div>
  );
}

function ThemeOption({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
        active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
      )}
    >
      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
    </button>
  );
}

function SettingRow({ label, description, defaultChecked, disabled }: { label: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} />
    </div>
  );
}
