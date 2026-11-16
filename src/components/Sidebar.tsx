import React, { useState } from 'react';
import {
  Camera,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ActiveView, StudySession } from '../types/study';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onNewChat: () => void;
  sessions: StudySession[];
  activeSessionId: string | null;
  onSelectSession: (session: StudySession) => void;
  onDeleteSession: (chatId: string) => void;
  user: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function formatModeLabel(mode: StudySession['mode'], lang: StudySession['language']): string {
  const m = mode === 'vision' ? 'Image' : mode === 'prompt' ? 'Prompt' : 'Chat';
  const l = lang === 'hausa' ? 'HA' : lang === 'bilingual' ? 'EN/HA' : 'EN';
  return `${m} · ${l}`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onNewChat,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  user,
  onOpenAuth,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) => {
  const [emblemError, setEmblemError] = useState(false);

  const navItems: Array<{ id: ActiveView; label: string; icon: React.ReactNode }> = [
    { id: 'chat', label: 'Study Chat', icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: 'vision', label: 'Image to Answer', icon: <Camera className="w-4 h-4 shrink-0" /> },
    { id: 'prompt', label: 'Prompt Generator', icon: <Terminal className="w-4 h-4 shrink-0" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
  ];

  const sidebarContent = (
    <div className="flex h-full w-[280px] flex-col bg-[#FAF9FC] border-r border-[#E9E5F5]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#E9E5F5]">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
        >
          {!emblemError ? (
            <img
              src="/src/assets/images/scorer_emblem_1794823384390.jpg"
              alt="Scorer's Study AI"
              referrerPolicy="no-referrer"
              onError={() => setEmblemError(true)}
              className="w-9 h-9 rounded-xl object-cover border border-[#E9E5F5] bg-white shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#6D28D9] text-white font-display font-bold flex items-center justify-center shrink-0">
              S
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm text-[#18122B] truncate">
              Scorer's Study AI
            </div>
            <div className="text-[11px] text-[#645C7A] truncate">
              Score Higher, Study Smarter
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#645C7A] hover:bg-[#EDE9FE]/50 hover:text-[#18122B] cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary New Chat CTA */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5B21B6] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Study Chat</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="px-3 space-y-1" aria-label="Workspace modes">
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#EDE9FE] text-[#4C1D95]'
                  : 'text-[#3D3456] hover:bg-[#F3F0FA] hover:text-[#18122B]'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Saved History List */}
      <div className="mt-4 flex-1 flex flex-col min-h-0 border-t border-[#E9E5F5]">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#645C7A]">Saved History</span>
          <span className="text-xs text-[#645C7A] tabular-nums">{sessions.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar space-y-1">
          {!user ? (
            <div className="mx-2 mt-1 rounded-xl border border-[#E9E5F5] bg-white p-3.5 text-xs text-[#645C7A]">
              <p className="leading-relaxed">
                Sign in with Google or Email to save your chats, textbook solutions, and app prompts.
              </p>
              <button
                type="button"
                onClick={() => {
                  onOpenAuth();
                  onCloseMobile();
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D28D9] hover:text-[#5B21B6] cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in now</span>
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[#645C7A]">
              No saved sessions yet. Ask a question to begin.
            </div>
          ) : (
            sessions.map((session) => {
              const isSelected = activeSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between rounded-xl transition-colors ${
                    isSelected ? 'bg-[#EDE9FE]/80' : 'hover:bg-[#F3F0FA]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(session);
                      onCloseMobile();
                    }}
                    className="flex-1 min-w-0 min-h-[44px] px-3 py-2 text-left cursor-pointer"
                  >
                    <div
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-[#4C1D95]' : 'text-[#18122B]'
                      }`}
                    >
                      {session.title}
                    </div>
                    <div className="text-[11px] text-[#645C7A] truncate mt-0.5 tabular-nums">
                      {formatModeLabel(session.mode, session.language)} · {formatRelativeTime(session.updatedAtMs)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-lg text-[#9890AC] opacity-80 lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-600 transition-opacity cursor-pointer"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User Account Footer */}
      <div className="p-3 border-t border-[#E9E5F5] bg-white">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Student'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-[#E9E5F5] shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#EDE9FE] text-[#5B21B6] font-display font-semibold text-xs flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#18122B] truncate">
                  {user.displayName || 'Student'}
                </div>
                <div className="text-[11px] text-[#645C7A] truncate">
                  {user.email}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#645C7A] hover:bg-[#F7F5FC] hover:text-[#18122B] transition-colors cursor-pointer shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenAuth();
              onCloseMobile();
            }}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[#DDD6FE] bg-[#FAF8FF] px-3 py-2 text-xs font-semibold text-[#5B21B6] hover:bg-[#EDE9FE] transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            <span>Sign In · Google or Email</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block h-full shrink-0">{sidebarContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#18122B]/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-2xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
