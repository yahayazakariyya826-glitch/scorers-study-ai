import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Loader2, Terminal } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { streamAIResponse } from '../lib/apiStream';
import { generateSafeId, persistStudyExchange } from '../lib/firestoreStudy';
import type { StudyMessage, StudySession } from '../types/study';

interface PromptGeneratorWorkspaceProps {
  userUid: string | null;
  emailVerified: boolean;
  idToken: string | null;
  activeSession: StudySession | null;
  savedMessages: StudyMessage[];
  onSessionCreated: (session: StudySession) => void;
}

const SAMPLE_IDEAS = [
  'I want to build food delivery app',
  'Campus hostel finder and room booking app for Nigerian universities',
  'WAEC and JAMB CBT practice app with timed quizzes and explanations',
  'Small business POS inventory and daily profit tracker',
];

export const PromptGeneratorWorkspace: React.FC<PromptGeneratorWorkspaceProps> = ({
  userUid,
  emailVerified,
  idToken,
  activeSession,
  savedMessages,
  onSessionCreated,
}) => {
  const [idea, setIdea] = useState('');
  const [targetTool, setTargetTool] = useState<'lovable-bolt' | 'lovable' | 'bolt'>('lovable-bolt');
  const [complexity, setComplexity] = useState<'mvp' | 'production'>('production');
  const [stack, setStack] = useState('React + TypeScript + Tailwind CSS + Supabase');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeSession?.mode === 'prompt' && savedMessages.length > 0) {
      const userMsg = savedMessages.find((m) => m.role === 'user');
      const assistantMsg = [...savedMessages].reverse().find((m) => m.role === 'assistant');
      if (userMsg) setIdea(userMsg.content);
      if (assistantMsg) setGeneratedPrompt(assistantMsg.content);
    }
  }, [activeSession, savedMessages]);

  const handleGenerate = async (overrideIdea?: string) => {
    const queryIdea = (overrideIdea ?? idea).trim();
    if (!queryIdea || isGenerating) return;
    if (overrideIdea) setIdea(overrideIdea);

    setError(null);
    setGeneratedPrompt('');
    setIsGenerating(true);

    let fullText = '';
    try {
      fullText = await streamAIResponse(
        '/api/prompt-generator/stream',
        {
          idea: queryIdea,
          targetTool,
          complexity,
          stack,
        },
        idToken,
        {
          onToken: (chunk) => {
            fullText += chunk;
            setGeneratedPrompt(fullText);
          },
          onError: (msg) => setError(msg),
          onDone: () => {},
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt.');
    } finally {
      setIsGenerating(false);
    }

    if (fullText.trim() && userUid && emailVerified) {
      const sessionId = generateSafeId('prompt');
      const title = `Prompt: ${queryIdea.slice(0, 55)}`;
      try {
        await persistStudyExchange({
          uid: userUid,
          chatId: sessionId,
          isNewSession: true,
          title,
          mode: 'prompt',
          language: 'english',
          examFocus: 'coding',
          previousMessageCount: 0,
          userText: queryIdea,
          assistantText: fullText,
        });
        onSessionCreated({
          id: sessionId,
          userId: userUid,
          title,
          mode: 'prompt',
          language: 'english',
          examFocus: 'coding',
          lastMessagePreview: fullText.replace(/\s+/g, ' ').slice(0, 240),
          messageCount: 2,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        });
      } catch (saveErr) {
        setError(
          saveErr instanceof Error
            ? `Generated, but cloud save failed: ${saveErr.message}`
            : 'Generated, but cloud save failed.'
        );
      }
    }
  };

  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="pb-5 border-b border-[#E9E5F5]">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-[#18122B]">
            Prompt Generator for Lovable & Bolt
          </h1>
          <p className="mt-1 text-sm text-[#645C7A]">
            Turn a simple app idea into a full, structured engineering prompt with database schema, user flows, and UI specifications.
          </p>
        </div>

        {/* Input & Options Card */}
        <div className="rounded-2xl border border-[#E9E5F5] bg-[#FAF9FC] p-4 sm:p-6 space-y-4">
          <div>
            <label htmlFor="idea-input" className="block text-xs font-semibold text-[#3D3456] mb-1.5">
              Describe the app you want to build
            </label>
            <textarea
              id="idea-input"
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder='e.g. "I want to build food delivery app"'
              className="w-full rounded-xl border border-[#DDD6FE] bg-white px-4 py-3 text-sm sm:text-[15px] text-[#18122B] placeholder:text-[#9890AC] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="target-builder" className="block text-xs font-medium text-[#645C7A] mb-1">
                Target Builder
              </label>
              <select
                id="target-builder"
                value={targetTool}
                onChange={(e) => setTargetTool(e.target.value as 'lovable-bolt' | 'lovable' | 'bolt')}
                className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3 text-xs sm:text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
              >
                <option value="lovable-bolt">Lovable & Bolt.new</option>
                <option value="lovable">Lovable.dev</option>
                <option value="bolt">Bolt.new</option>
              </select>
            </div>

            <div>
              <label htmlFor="complexity-select" className="block text-xs font-medium text-[#645C7A] mb-1">
                Scope
              </label>
              <select
                id="complexity-select"
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as 'mvp' | 'production')}
                className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3 text-xs sm:text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
              >
                <option value="production">Full Production Spec</option>
                <option value="mvp">Lean MVP</option>
              </select>
            </div>

            <div>
              <label htmlFor="stack-select" className="block text-xs font-medium text-[#645C7A] mb-1">
                Preferred Stack
              </label>
              <select
                id="stack-select"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3 text-xs sm:text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
              >
                <option value="React + TypeScript + Tailwind CSS + Supabase">React + Tailwind + Supabase</option>
                <option value="Next.js App Router + TypeScript + PostgreSQL">Next.js + Postgres</option>
                <option value="React + Vite + Firebase Auth & Firestore">React + Firebase</option>
              </select>
            </div>
          </div>

          {/* Clickable Quick Starters */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-[#645C7A]">Try:</span>
            {SAMPLE_IDEAS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void handleGenerate(sample)}
                disabled={isGenerating}
                className="min-h-[34px] rounded-lg border border-[#E9E5F5] bg-white px-3 py-1 text-xs text-[#3D3456] hover:border-[#C4B5FD] hover:text-[#5B21B6] transition-colors cursor-pointer text-left"
              >
                {sample}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!idea.trim() || isGenerating}
              className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:bg-[#DDD6FE] disabled:text-[#9890AC] transition-colors cursor-pointer whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Full Prompt...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4" />
                  <span>Generate Build Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="rounded-2xl border border-[#E9E5F5] bg-white">
          <div className="px-5 py-3.5 border-b border-[#E9E5F5] flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-[#18122B]">
              Generated Build Prompt
            </span>
            {generatedPrompt && (
              <button
                type="button"
                onClick={() => void handleCopyPrompt()}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#EDE9FE] px-3 py-1.5 text-xs font-semibold text-[#5B21B6] hover:bg-[#DDD6FE] transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Prompt' : 'Copy Full Prompt'}</span>
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6 min-h-[260px]">
            {generatedPrompt ? (
              <MarkdownRenderer content={generatedPrompt} />
            ) : isGenerating ? (
              <div className="py-12 text-center text-sm text-[#645C7A]">
                Drafting architecture, database schema, and screen flows...
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#645C7A] max-w-md mx-auto leading-relaxed">
                Enter an app idea above (such as &ldquo;I want to build food delivery app&rdquo;) and click Generate Build Prompt to get a complete specification ready for Lovable or Bolt.new.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
