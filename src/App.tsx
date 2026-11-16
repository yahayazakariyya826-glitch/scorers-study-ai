import React, { useEffect, useState } from 'react';
import { LogIn, Menu, Plus } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VisionWorkspace } from './components/VisionWorkspace';
import { PromptGeneratorWorkspace } from './components/PromptGeneratorWorkspace';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import { AuthModal } from './components/AuthModal';
import {
  deleteStudySession,
  saveUserSettings,
  subscribeSessionMessages,
  subscribeStudySessions,
  subscribeUserSettings,
} from './lib/firestoreStudy';
import type {
  ActiveView,
  ExamFocus,
  ExplanationDepth,
  StudyLanguage,
  StudyMessage,
  StudySession,
  UserSettings,
} from './types/study';

function StudyApp() {
  const { user, authReady, idToken, signOut } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<StudyMessage[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  const [language, setLanguage] = useState<StudyLanguage>('english');
  const [examFocus, setExamFocus] = useState<ExamFocus>('general');
  const [explanationDepth, setExplanationDepth] = useState<ExplanationDepth>('step-by-step');

  const [chatResetKey, setChatResetKey] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Subscribe to user settings & study session history once auth is ready
  useEffect(() => {
    if (!authReady || !user) {
      setSessions([]);
      setSessionMessages([]);
      setUserSettings(null);
      setActiveSessionId(null);
      return;
    }

    const unsubSettings = subscribeUserSettings(
      user.uid,
      (loaded) => {
        if (loaded) {
          setUserSettings(loaded);
          setLanguage(loaded.preferredLanguage);
          setExamFocus(loaded.examFocus);
          setExplanationDepth(loaded.explanationDepth);
        } else if (user.emailVerified) {
          void saveUserSettings(user.uid, {
            displayName: user.displayName || user.email?.split('@')[0] || 'Student',
            preferredLanguage: 'english',
            examFocus: 'general',
            explanationDepth: 'step-by-step',
          }).catch(() => {});
        }
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    const unsubSessions = subscribeStudySessions(
      user.uid,
      (items) => {
        setSessions(items);
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    return () => {
      unsubSettings();
      unsubSessions();
    };
  }, [authReady, user]);

  // Subscribe to active session messages
  useEffect(() => {
    if (!authReady || !user || !activeSessionId) {
      setSessionMessages([]);
      return;
    }

    const unsubMessages = subscribeSessionMessages(
      user.uid,
      activeSessionId,
      (msgs) => {
        setSessionMessages(msgs);
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    return () => {
      unsubMessages();
    };
  }, [authReady, user, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const handleNewChat = () => {
    setActiveSessionId(null);
    setSessionMessages([]);
    setActiveView('chat');
    setChatResetKey((k) => k + 1);
  };

  const handleSelectSession = (session: StudySession) => {
    setActiveSessionId(session.id);
    setLanguage(session.language);
    setExamFocus(session.examFocus);
    setActiveView(session.mode);
  };

  const handleDeleteSession = async (chatId: string) => {
    if (!user) return;
    if (activeSessionId === chatId) {
      setActiveSessionId(null);
      setSessionMessages([]);
    }
    try {
      await deleteStudySession(user.uid, chatId);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to delete session.');
    }
  };

  const handleSessionCreated = (newSession: StudySession) => {
    setSessions((prev) => {
      if (prev.some((s) => s.id === newSession.id)) return prev;
      return [newSession, ...prev];
    });
    setActiveSessionId(newSession.id);
  };

  const mobileTitle =
    activeView === 'vision'
      ? 'Image to Answer'
      : activeView === 'prompt'
      ? 'Prompt Generator'
      : activeView === 'settings'
      ? 'Settings'
      : activeSession?.title || "Scorer's Study AI";

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-white text-[#18122B]">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        onNewChat={handleNewChat}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={() => void signOut()}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Compact Mobile Top Bar (<= 52px, respects 15% mobile sticky cap) */}
        <header className="lg:hidden shrink-0 h-[52px] border-b border-[#E9E5F5] bg-white px-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#3D3456] hover:bg-[#F7F5FC] cursor-pointer shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span className="font-display font-semibold text-sm text-[#18122B] truncate">
            {mobileTitle}
          </span>

          {user ? (
            <button
              type="button"
              onClick={handleNewChat}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#6D28D9] hover:bg-[#F7F5FC] cursor-pointer shrink-0"
              aria-label="New study chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="min-h-[44px] px-2.5 flex items-center justify-center gap-1 rounded-xl text-xs font-semibold text-[#6D28D9] hover:bg-[#F7F5FC] cursor-pointer shrink-0 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </header>

        {/* Unverified Email Notice (non-blocking) */}
        {user && !user.emailVerified && activeView !== 'settings' && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-900">
            <span className="truncate">
              Verify your email ({user.email}) to sync chat history across sessions.
            </span>
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className="font-semibold underline underline-offset-2 whitespace-nowrap cursor-pointer shrink-0"
            >
              Verify in Settings
            </button>
          </div>
        )}

        {syncError && (
          <div className="shrink-0 bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-red-700">
            <span className="truncate">{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="font-semibold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Workspace View */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {activeView === 'chat' && (
            <ChatWorkspace
              key={activeSessionId || `guest_${chatResetKey}`}
              userUid={user?.uid ?? null}
              emailVerified={Boolean(user?.emailVerified)}
              idToken={idToken}
              activeSession={activeSession?.mode === 'chat' ? activeSession : null}
              messages={activeSession?.mode === 'chat' ? sessionMessages : []}
              language={language}
              onChangeLanguage={setLanguage}
              examFocus={examFocus}
              onChangeExamFocus={setExamFocus}
              explanationDepth={explanationDepth}
              onSessionCreated={handleSessionCreated}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activeView === 'vision' && (
            <VisionWorkspace
              userUid={user?.uid ?? null}
              emailVerified={Boolean(user?.emailVerified)}
              idToken={idToken}
              language={language}
              onChangeLanguage={setLanguage}
              examFocus={examFocus}
              activeSession={activeSession?.mode === 'vision' ? activeSession : null}
              savedMessages={activeSession?.mode === 'vision' ? sessionMessages : []}
              onSessionCreated={handleSessionCreated}
            />
          )}

          {activeView === 'prompt' && (
            <PromptGeneratorWorkspace
              userUid={user?.uid ?? null}
              emailVerified={Boolean(user?.emailVerified)}
              idToken={idToken}
              activeSession={activeSession?.mode === 'prompt' ? activeSession : null}
              savedMessages={activeSession?.mode === 'prompt' ? sessionMessages : []}
              onSessionCreated={handleSessionCreated}
            />
          )}

          {activeView === 'settings' && (
            <SettingsWorkspace
              settings={userSettings}
              language={language}
              onChangeLanguage={setLanguage}
              examFocus={examFocus}
              onChangeExamFocus={setExamFocus}
              explanationDepth={explanationDepth}
              onChangeExplanationDepth={setExplanationDepth}
              savedSessionCount={sessions.length}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}
        </main>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StudyApp />
    </AuthProvider>
  );
}
