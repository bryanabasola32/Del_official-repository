'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles, Users, Brain, CalendarDays, BarChart3, Settings,
  Bell, Menu, X, LogOut, ChevronDown, Loader2,
  Plus, Search, MessageSquare, MoreHorizontal, Trash2, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { NotificationItem } from '@/lib/types';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/components/AuthProvider';
import { useConversationContext } from '@/components/ConversationProvider';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

const LOGO_SRC = '/del-logo.png';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_SECTIONS: { heading?: string; items: NavItem[] }[] = [
  {
    heading: 'DEL',
    items: [
      { label: 'DEL Intelligence', href: '/command-center', icon: Sparkles },
    ],
  },
  {
    items: [
      { label: 'Executive List', href: '/executives', icon: Users },
      { label: 'Executive Intelligence', href: '/intelligence', icon: Brain },
      { label: 'Event List', href: '/events', icon: CalendarDays },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const STORAGE_KEY = 'del-sidebar-collapsed';
const FLYOUT_KEY = 'del-intelligence-flyout';
const SEEN_NOTIFS_KEY = 'del-seen-notifications';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const isAuthRoute = AUTH_ROUTES.includes(pathname || '');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [seenNotifIds, setSeenNotifIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const {
    conversations, loading: convsLoading, activeConversationId,
    selectConversation, createConversation, renameConversation,
    deleteConversation, searchConversations, refreshConversations,
  } = useConversationContext();

  // Restore sidebar + flyout state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === 'true');
      }
      const flyoutStored = localStorage.getItem(FLYOUT_KEY);
      if (flyoutStored !== null) {
        setFlyoutOpen(flyoutStored === 'true');
      }
      const seenStored = localStorage.getItem(SEEN_NOTIFS_KEY);
      if (seenStored) {
        const parsed = JSON.parse(seenStored);
        if (Array.isArray(parsed)) {
          setSeenNotifIds(new Set(parsed.filter((s): s is string => typeof s === 'string')));
        }
      }
    } catch {
      // localStorage not available
    }
  }, []);

  // Load conversations when flyout opens — only once per open transition
  const flyoutOpenedRef = useRef(false);
  useEffect(() => {
    if (flyoutOpen) {
      if (!flyoutOpenedRef.current) {
        flyoutOpenedRef.current = true;
        refreshConversations();
      }
    } else {
      flyoutOpenedRef.current = false;
    }
  }, [flyoutOpen, refreshConversations]);

  // Close flyout when clicking outside the sidebar
  useEffect(() => {
    if (!flyoutOpen || collapsed) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false);
        try {
          localStorage.setItem(FLYOUT_KEY, 'false');
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [flyoutOpen, collapsed]);

  const toggleFlyout = useCallback(() => {
    setFlyoutOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(FLYOUT_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleNewChat = useCallback(async () => {
    const id = await createConversation();
    if (id) {
      await selectConversation(id);
    } else {
      selectConversation(null);
    }
    router.push('/command-center');
    // Keep flyout open — user stays in context
  }, [createConversation, selectConversation, router]);

  const handleSelectConversation = useCallback(async (id: string) => {
    await selectConversation(id);
    router.push('/command-center');
    // Keep flyout open — active conversation is highlighted
  }, [selectConversation, router]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    searchConversations(e.target.value);
  }, [searchConversations]);

  const handleRenameStart = useCallback((id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (renamingId && renameValue.trim()) {
      await renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameConversation]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    setDeleteConfirmId(null);
  }, [deleteConversation]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const items: NotificationItem[] = [];

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, company, title, last_researched_date, persona_status')
        .in('persona_status', ['completed', 'low_confidence']);

      if (contacts) {
        const now = new Date();
        for (const c of contacts) {
          if (!c.last_researched_date) continue;
          const daysSince = Math.floor((now.getTime() - new Date(c.last_researched_date).getTime()) / 86400000);
          if (daysSince > 30) {
            items.push({
              id: `freshness-${c.id}`,
              type: 'freshness',
              title: 'Data Freshness Reminder',
              message: `${c.name} (${c.company}) was last researched ${daysSince} days ago. Intelligence may be stale.`,
              contactId: c.id,
              severity: daysSince > 60 ? 'warning' : 'info',
              timestamp: c.last_researched_date,
            });
          }
        }
      }

      const { data: activity } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (activity) {
        for (const a of activity) {
          if (a.action_type === 'generate_intelligence' && a.status === 'success') {
            items.push({
              id: `activity-${a.id}`,
              type: 'intelligence_complete',
              title: 'Intelligence Generated',
              message: a.description || 'Executive Intelligence completed',
              contactId: a.related_contact_id || undefined,
              severity: 'success',
              timestamp: a.timestamp,
            });
          }
          if (a.action_type === 'send_invite' && a.status === 'success') {
            items.push({
              id: `activity-${a.id}`,
              type: 'invite_sent',
              title: 'Invitation Sent',
              message: a.description || 'Invitation sent',
              severity: 'success',
              timestamp: a.timestamp,
            });
          }
        }
      }

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(items);
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthRoute || authLoading || !user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isAuthRoute, authLoading, user]);

  // Reset scroll position on route change so list/detail don't share scroll state
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !seenNotifIds.has(n.id)).length;

  const handleNotifOpen = useCallback(() => {
    setNotifOpen(true);
    const newSeen = new Set(seenNotifIds);
    for (const n of notifications) {
      newSeen.add(n.id);
    }
    setSeenNotifIds(newSeen);
    try {
      localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(Array.from(newSeen)));
    } catch {
      // ignore
    }
  }, [notifications, seenNotifIds]);

  const renderIntelligenceItem = () => {
    const isActive = pathname === '/command-center' || pathname?.startsWith('/command-center/');

    // When sidebar is collapsed, navigate directly to /command-center
    if (collapsed) {
      return (
        <Tooltip key="/command-center">
          <TooltipTrigger asChild>
            <Link
              href="/command-center"
              className={cn(
                'flex items-center justify-center rounded-lg text-sm font-medium transition-all px-0 py-2.5 w-10 h-10 mx-auto',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Sparkles className="h-4.5 w-4.5 shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            DEL Intelligence
          </TooltipContent>
        </Tooltip>
      );
    }

    // Expanded sidebar — toggle flyout or navigate
    return (
      <div key="/command-center">
        <button
          onClick={toggleFlyout}
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-all w-full gap-3 px-3 py-2.5',
            isActive || flyoutOpen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Sparkles className="h-4.5 w-4.5 shrink-0" />
          <span className="flex-1 text-left">DEL Intelligence</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', flyoutOpen && 'rotate-180')} />
        </button>

        {/* Inline collapsible panel — pushes nav items down naturally */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            flyoutOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-1 rounded-lg border border-border bg-background/50">
              {/* Sticky header: New Chat + Search */}
              <div className="sticky top-0 z-10 bg-card rounded-t-lg">
                <div className="p-2 border-b border-border">
                  <Button
                    onClick={handleNewChat}
                    className="w-full"
                    variant="default"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                </div>
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Search chats..."
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Scrollable conversation list */}
              <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
                {convsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-6 px-3">
                    <MessageSquare className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">No conversations yet</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Start a new chat to begin</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors',
                        activeConversationId === conv.id
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'hover:bg-muted/50 text-muted-foreground',
                      )}
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      {renamingId === conv.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRenameSave}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSave();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="flex-1 bg-transparent border-none outline-none text-xs text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <MessageSquare className="h-3 w-3 shrink-0 opacity-50" />
                          <span className="flex-1 truncate text-xs">{conv.title}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameStart(conv.id, conv.title); }}>
                                <Pencil className="h-3 w-3 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(conv.id); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNavItem = (item: NavItem, onClick?: () => void) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname?.startsWith(item.href + '/');

    const linkContent = (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-all',
          collapsed
            ? 'justify-center px-0 py-2.5'
            : 'gap-3 px-3 py-2.5',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <Icon className="h-4.5 w-4.5 shrink-0" />
        {!collapsed && item.label}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <div>{linkContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  const renderNav = (onClick?: () => void) => (
    <TooltipProvider delayDuration={200}>
      {NAV_SECTIONS.map((section, sIdx) => (
        <div key={sIdx}>
          {section.heading && !collapsed && (
            <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.heading}
            </div>
          )}
          {sIdx > 0 && !section.heading && <div className="mx-3 my-2 border-t border-border" />}
          {sIdx > 0 && collapsed && <div className="mx-2 my-2 border-t border-border" />}
          <div className={cn('space-y-1', collapsed && 'px-1')}>
            {section.items.map((item) =>
              item.href === '/command-center'
                ? renderIntelligenceItem()
                : renderNavItem(item, onClick)
            )}
          </div>
        </div>
      ))}
    </TooltipProvider>
  );

  // Redirect unauthenticated users to login (non-auth routes only)
  useEffect(() => {
    if (!authLoading && !user && !isAuthRoute) {
      router.replace('/login');
    }
  }, [authLoading, user, isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userEmail = user?.email || '';
  const userInitials = userEmail.substring(0, 2).toUpperCase();
  const displayName = userEmail.split('@')[0] || 'User';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop (fixed) */}
      <aside
        ref={sidebarRef}
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out fixed left-0 top-0 bottom-0 z-40',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <button
          onClick={toggleCollapsed}
          className={cn(
            'flex h-16 items-center border-b border-border w-full cursor-pointer hover:bg-muted/50 transition-colors',
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-5'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <img src={LOGO_SRC} alt="DEL Logo" className="h-9 w-9 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="text-lg font-bold tracking-tight text-foreground">DEL</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">DELCA VisionTech</div>
            </div>
          )}
        </button>
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
          {renderNav()}
        </nav>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border animate-slide-in-right">
            <div className="flex h-16 items-center justify-between px-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <img src={LOGO_SRC} alt="DEL Logo" className="h-9 w-9 shrink-0 object-contain" />
                <span className="text-lg font-bold">DEL</span>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
              {renderNav(() => setMobileOpen(false))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content — offset for fixed sidebar */}
      <div className={cn('flex-1 flex flex-col min-w-0 h-screen lg:transition-[margin] duration-200 ease-in-out', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <img src={LOGO_SRC} alt="DEL Logo" className="h-7 w-7 shrink-0 object-contain" />
              <span className="font-bold">DEL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleNotifOpen}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {userInitials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-foreground">{displayName}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{userEmail}</div>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-auto scrollbar-thin">
          <div key={pathname} className="animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Notifications panel */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        loading={notifLoading}
        onNavigate={(href) => {
          setNotifOpen(false);
          router.push(href);
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
