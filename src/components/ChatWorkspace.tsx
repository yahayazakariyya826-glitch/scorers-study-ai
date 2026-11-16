import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Check,
  Copy,
  Square,
  RotateCcw,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { streamAIResponse } from '../lib/apiStream';
import { generateSafeId, persistStudyExchange } from '../lib/firestoreStudy';
import type {
  ExamFocus,
  ExplanationDepth,
  StudyLanguage,
  StudyMessage,
  StudySession,
} from '../types/study';

interface ChatWorkspaceProps {
  userUid: string | null;
  emailVerified: boolean;
  idToken: string | null;
  activeSession: StudySession | null;
  messages: StudyMessage[];
  language: StudyLanguage;
  onChangeLanguage: (lang: StudyLanguage) => void;
  examFocus: ExamFocus;
  onChangeExamFocus: (focus: ExamFocus) => void;
  explanationDepth: ExplanationDepth;
  onSessionCreated: (session: StudySession) => void;
  onOpenAuth: () => void;
}

const STARTER_PROMPTS: Array<{ label: string; prompt: string; lang: StudyLanguage }> = [
  {
    label: 'JAMB Physics · Projectile Motion',
    prompt: 'Explain projectile motion with formulas and solve a typical JAMB UTME question step by step.',
    lang: 'english',
  },
  {
    label: 'Hausa · Kimiyyar Halitta (Photosynthesis)',
    prompt: 'Yi min bayani dalla-dalla cikin Hausa kan yadda tsirrai ke yin photosynthesis da muhimmancinsa.',
    lang: 'hausa',
  },
  {
    label: 'WAEC Chemistry · Mole Concept',
    prompt: 'How do I calculate molarity and number of moles for WAEC Chemistry theory questions? Give 2 worked examples.',
    lang: 'english',
  },
  {
    label: 'Bilingual · Quadratic Equations',
    prompt: 'Solve 2x² - 7x + 3 = 0 using the quadratic formula, then summarize the steps in Hausa.',
    lang: 'bilingual',
  },
];

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  userUid,
  emailVerified,
  idToken,
  activeSession,
  messages,
  language,
  onChangeLanguage,
  examFocus,
  onChangeExamFocus,
  explanationDepth,
  onSessionCreated,
  onOpenAuth,
}) => {
  const [localMessages, setLocalMessages] = useState<StudyMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync messages when active session changes or Firestore updates
  useEffect(() => {
    if (activeSession && userUid && emailVerified) {
      setLocalMessages(messages);
    } else if (!activeSession) {
      // Keep local guest messages only when not switching to a saved session
    }
  }, [activeSession, messages, userUid, emailVerified]);

  // Clear local guest messages when starting a fresh chat explicitly
  useEffect(() => {
    if (!activeSession && !isStreaming && !pendingUserText) {
      // Check if we switched away from an active session
    }
  }, [activeSession, isStreaming, pendingUserText]);

  const displayedMessages = activeSession && userUid && emailVerified ? messages : localMessages;

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages.length, streamingContent, pendingUserText]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const sendQuestion = async (rawText: string, overrideLanguage?: StudyLanguage) => {
    const trimmed = rawText.trim();
    if (!trimmed || isStreaming) return;

    const chosenLang = overrideLanguage ?? language;
    if (overrideLanguage && overrideLanguage !== language) {
      onChangeLanguage(overrideLanguage);
    }

    setError(null);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const baseHistory = displayedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const payloadMessages = [...baseHistory, { role: 'user' as const, content: trimmed }];

    setPendingUserText(trimmed);
    setStreamingContent('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';
    try {
      accumulated = await streamAIResponse(
        '/api/chat/stream',
        {
          messages: payloadMessages,
          language: chosenLang,
          examFocus,
          explanationDepth,
        },
        idToken,
        {
          onToken: (chunk) => {
            accumulated += chunk;
            setStreamingContent(accumulated);
          },
          onError: (msg) => {
            setError(msg);
          },
          onDone: () => {},
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Unable to reach AI tutor.');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }

    if (!accumulated.trim()) {
      setPendingUserText(null);
      setStreamingContent('');
      return;
    }

    const sessionId = activeSession?.id || generateSafeId('chat');
    const isNewSession = !activeSession;
    const title = activeSession?.title || trimmed.slice(0, 65);

    if (userUid && emailVerified) {
      try {
        await persistStudyExchange({
          uid: userUid,
          chatId: sessionId,
          isNewSession,
          title,
          mode: 'chat',
          language: chosenLang,
          examFocus,
          previousMessageCount: displayedMessages.length,
          userText: trimmed,
          assistantText: accumulated,
        });

        if (isNewSession) {
          onSessionCreated({
            id: sessionId,
            userId: userUid,
            title,
            mode: 'chat',
            language: chosenLang,
            examFocus,
            lastMessagePreview: accumulated.replace(/\s+/g, ' ').slice(0, 240),
            messageCount: 2,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          });
        }
      } catch (saveErr) {
        setError(
          saveErr instanceof Error
            ? `Answer generated, but cloud sync failed: ${saveErr.message}`
            : 'Answer generated, but could not save to cloud history.'
        );
      }
    } else {
      const now = Date.now();
      setLocalMessages((prev) => [
        ...prev,
        {
          id: generateSafeId('local_u'),
          chatId: sessionId,
          userId: 'guest',
          role: 'user',
          content: trimmed,
          language: chosenLang,
          hasAttachment: false,
          createdAtMs: now,
        },
        {
          id: generateSafeId('local_a'),
          chatId: sessionId,
          userId: 'guest',
          role: 'assistant',
          content: accumulated,
          language: chosenLang,
          hasAttachment: false,
          createdAtMs: now + 1,
        },
      ]);
    }

    setPendingUserText(null);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendQuestion(input);
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Workspace Toolbar: Language & Exam Focus */}
      <div className="shrink-0 border-b border-[#E9E5F5] bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#F7F5FC] rounded-xl">
          {(
            [
              { id: 'english', label: 'English' },
              { id: 'hausa', label: 'Hausa' },
              { id: 'bilingual', label: 'EN + Hausa' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLanguage(item.id)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                language === item.id
                  ? 'bg-white text-[#5B21B6] shadow-xs'
                  : 'text-[#645C7A] hover:text-[#18122B]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="exam-focus-select" className="text-xs font-medium text-[#645C7A] whitespace-nowrap">
            Focus
          </label>
          <select
            id="exam-focus-select"
            value={examFocus}
            onChange={(e) => onChangeExamFocus(e.target.value as ExamFocus)}
            className="min-h-[36px] rounded-lg border border-[#E9E5F5] bg-white px-2.5 py-1 text-xs font-medium text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
          >
            <option value="general">General Study</option>
            <option value="jamb">JAMB / UTME</option>
            <option value="waec">WAEC / NECO</option>
            <option value="university">University</option>
            <option value="coding">Coding & Tech</option>
          </select>

          {!activeSession && localMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setLocalMessages([])}
              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-[#645C7A] hover:bg-[#F7F5FC] hover:text-[#18122B] cursor-pointer whitespace-nowrap"
              title="Clear session"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Thread */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
        <div className="mx-auto max-w-3xl">
          {displayedMessages.length === 0 && !pendingUserText ? (
            <div className="py-8 sm:py-14 flex flex-col items-center text-center">
              <img
                src="/src/assets/images/scorer_emblem_1794823384390.jpg"
                alt="Scorer's Study AI"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-[#E9E5F5] bg-white mb-5"
              />
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18122B] tracking-tight text-balance">
                Score Higher, Study Smarter
              </h1>
              <p className="mt-2 max-w-lg text-sm sm:text-base text-[#645C7A] leading-relaxed">
                Ask any WAEC, NECO, JAMB, or university question in English or Hausa and get clear, step-by-step explanations.
              </p>

              {!userUid && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="mt-4 text-xs font-medium text-[#6D28D9] hover:text-[#5B21B6] underline underline-offset-4 cursor-pointer"
                >
                  Sign in with Google or Email to save your study history
                </button>
              )}

              <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => void sendQuestion(item.prompt, item.lang)}
                    className="group rounded-2xl border border-[#E9E5F5] bg-white p-4 hover:border-[#C4B5FD] hover:bg-[#FAF8FF] transition-all text-left cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-[#6D28D9]">{item.label}</div>
                    <div className="mt-1 text-sm text-[#3D3456] line-clamp-2 leading-snug">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-[#6D28D9] px-4 py-3 text-sm sm:text-[15px] text-white leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full flex items-start gap-3.5">
                      <img
                        src="/src/assets/images/scorer_emblem_1794823384390.jpg"
                        alt="AI"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover border border-[#E9E5F5] shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <MarkdownRenderer content={msg.content} />
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg.id, msg.content)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#645C7A] hover:text-[#18122B] transition-colors cursor-pointer py-1"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#6D28D9]" />
                                <span className="text-[#6D28D9]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy answer</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Active Pending / Streaming Exchange */}
              {pendingUserText && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-[#6D28D9] px-4 py-3 text-sm sm:text-[15px] text-white leading-relaxed whitespace-pre-wrap">
                      {pendingUserText}
                    </div>
                  </div>
                  <div className="w-full flex items-start gap-3.5">
                    <img
                      src="/src/assets/images/scorer_emblem_1794823384390.jpg"
                      alt="AI"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-cover border border-[#E9E5F5] shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {streamingContent ? (
                        <MarkdownRenderer content={streamingContent} />
                      ) : (
                        <div className="py-2 text-sm text-[#645C7A]">
                          {language === 'hausa' ? 'Ana shirya amsa...' : 'Thinking through your question...'}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div ref={scrollEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-2">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        </div>
      )}

      {/* Bottom Sticky Composer */}
      <div className="shrink-0 border-t border-[#E9E5F5] bg-white px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-[#DDD6FE] bg-[#FAF9FC] p-2 focus-within:border-[#6D28D9] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6D28D9]/15 transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'hausa'
                  ? 'Rubuta tambayarka anan (misali: Yaya ake lissafin quadratic equation?)...'
                  : 'Ask any study question in English or Hausa...'
              }
              className="flex-1 max-h-40 resize-none bg-transparent px-2.5 py-2 text-sm sm:text-[15px] text-[#18122B] placeholder:text-[#9890AC] focus:outline-none leading-relaxed"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#18122B] text-white hover:bg-[#3D3456] transition-colors cursor-pointer shrink-0"
                aria-label="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] disabled:bg-[#DDD6FE] disabled:text-[#9890AC] transition-colors cursor-pointer shrink-0"
                aria-label="Send question"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
