import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { prepareImageForVision, streamAIResponse } from '../lib/apiStream';
import { generateSafeId, persistStudyExchange } from '../lib/firestoreStudy';
import type { ExamFocus, StudyLanguage, StudyMessage, StudySession } from '../types/study';

interface VisionWorkspaceProps {
  userUid: string | null;
  emailVerified: boolean;
  idToken: string | null;
  language: StudyLanguage;
  onChangeLanguage: (lang: StudyLanguage) => void;
  examFocus: ExamFocus;
  activeSession: StudySession | null;
  savedMessages: StudyMessage[];
  onSessionCreated: (session: StudySession) => void;
}

export const VisionWorkspace: React.FC<VisionWorkspaceProps> = ({
  userUid,
  emailVerified,
  idToken,
  language,
  onChangeLanguage,
  examFocus,
  activeSession,
  savedMessages,
  onSessionCreated,
}) => {
  const [imageData, setImageData] = useState<{
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    previewUrl: string;
    fileName: string;
  } | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [solution, setSolution] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // When a saved vision session is selected from history, display its saved assistant solution
  useEffect(() => {
    if (activeSession?.mode === 'vision' && savedMessages.length > 0) {
      const lastAssistant = [...savedMessages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        setSolution(lastAssistant.content);
      }
    }
  }, [activeSession, savedMessages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareImageForVision(file);
      setImageData({
        ...prepared,
        fileName: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process selected image.');
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareImageForVision(file);
      setImageData({
        ...prepared,
        fileName: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process dropped image.');
    }
  };

  const handleSolve = async () => {
    if (!imageData || isSolving) return;
    setError(null);
    setSolution('');
    setIsSolving(true);

    let fullText = '';
    try {
      fullText = await streamAIResponse(
        '/api/vision/solve',
        {
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          prompt: extraPrompt.trim(),
          language,
          examFocus,
        },
        idToken,
        {
          onToken: (chunk) => {
            fullText += chunk;
            setSolution(fullText);
          },
          onError: (msg) => setError(msg),
          onDone: () => {},
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image.');
    } finally {
      setIsSolving(false);
    }

    if (fullText.trim() && userUid && emailVerified) {
      const sessionId = generateSafeId('vision');
      const title = extraPrompt.trim()
        ? `Image: ${extraPrompt.trim().slice(0, 55)}`
        : `Image Solution (${imageData.fileName.slice(0, 35)})`;
      const userRecordText = extraPrompt.trim()
        ? `[Uploaded Image: ${imageData.fileName}]\n${extraPrompt.trim()}`
        : `[Uploaded Image: ${imageData.fileName}] Solve step by step.`;

      try {
        await persistStudyExchange({
          uid: userUid,
          chatId: sessionId,
          isNewSession: true,
          title,
          mode: 'vision',
          language,
          examFocus,
          previousMessageCount: 0,
          userText: userRecordText,
          assistantText: fullText,
          hasAttachment: true,
        });
        onSessionCreated({
          id: sessionId,
          userId: userUid,
          title,
          mode: 'vision',
          language,
          examFocus,
          lastMessagePreview: fullText.replace(/\s+/g, ' ').slice(0, 240),
          messageCount: 2,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        });
      } catch (saveErr) {
        setError(
          saveErr instanceof Error
            ? `Solved, but cloud save failed: ${saveErr.message}`
            : 'Solved, but cloud save failed.'
        );
      }
    }
  };

  const handleCopy = async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#E9E5F5]">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-[#18122B]">
              Image to Answer
            </h1>
            <p className="mt-1 text-sm text-[#645C7A]">
              Snap or upload a textbook page, past question, or handwritten assignment for a step-by-step Gemini Vision solution.
            </p>
          </div>

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
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Upload & Instructions */}
          <div className="lg:col-span-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {!imageData ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="rounded-2xl border-2 border-dashed border-[#DDD6FE] bg-[#FAF8FF] p-6 text-center"
              >
                <div className="mx-auto w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#6D28D9] flex items-center justify-center mb-3">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <h2 className="font-display text-sm font-semibold text-[#18122B]">
                  Upload assignment or textbook photo
                </h2>
                <p className="mt-1 text-xs text-[#645C7A]">
                  JPEG, PNG, or WebP · Automatically compressed for fast mobile upload
                </p>

                <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-medium text-white hover:bg-[#5B21B6] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ImagePlus className="w-4 h-4 shrink-0" />
                    <span>Choose Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD6FE] bg-white px-4 py-2 text-xs font-medium text-[#5B21B6] hover:bg-[#F7F5FC] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E9E5F5] bg-[#FAF9FC] overflow-hidden">
                <div className="relative bg-white">
                  <img
                    src={imageData.previewUrl}
                    alt="Uploaded assignment preview"
                    className="w-full max-h-80 object-contain mx-auto"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(imageData.previewUrl);
                      setImageData(null);
                    }}
                    className="absolute top-3 right-3 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/95 border border-[#E9E5F5] text-[#645C7A] hover:text-red-600 shadow-xs cursor-pointer"
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-4 py-2.5 border-t border-[#E9E5F5] flex items-center justify-between text-xs text-[#645C7A]">
                  <span className="truncate">{imageData.fileName}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-[#6D28D9] hover:text-[#5B21B6] cursor-pointer whitespace-nowrap ml-2"
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="vision-note" className="block text-xs font-medium text-[#3D3456] mb-1.5">
                Specific instruction (optional)
              </label>
              <textarea
                id="vision-note"
                rows={3}
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="e.g., Solve question 2b only, or check if my workings are right"
                className="w-full rounded-xl border border-[#E9E5F5] bg-white px-3.5 py-2.5 text-sm text-[#18122B] placeholder:text-[#9890AC] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSolve()}
              disabled={!imageData || isSolving}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-3 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:bg-[#DDD6FE] disabled:text-[#9890AC] transition-colors cursor-pointer"
            >
              {isSolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Solving...</span>
                </>
              ) : (
                <span>Solve Step-by-Step</span>
              )}
            </button>
          </div>

          {/* Right Column: Step-by-Step Solution */}
          <div className="lg:col-span-7 rounded-2xl border border-[#E9E5F5] bg-white min-h-[360px] flex flex-col">
            <div className="px-5 py-3.5 border-b border-[#E9E5F5] flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-[#18122B]">
                Step-by-Step Solution
              </span>
              {solution && (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#5B21B6] hover:bg-[#F7F5FC] cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy solution'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-5 sm:p-6">
              {solution ? (
                <MarkdownRenderer content={solution} />
              ) : isSolving ? (
                <div className="py-16 text-center text-sm text-[#645C7A]">
                  Reading the image and preparing step-by-step workings...
                </div>
              ) : (
                <div className="py-16 text-center max-w-sm mx-auto">
                  <p className="text-sm font-medium text-[#3D3456]">
                    Ready to solve your assignment
                  </p>
                  <p className="mt-1.5 text-xs text-[#645C7A] leading-relaxed">
                    Upload a clear photo of Mathematics, Physics, Chemistry, Accounting, or Biology questions and get full workings you can follow.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
