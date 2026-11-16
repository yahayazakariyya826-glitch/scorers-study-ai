import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { saveUserSettings } from '../lib/firestoreStudy';
import type { ExamFocus, ExplanationDepth, StudyLanguage, UserSettings } from '../types/study';

interface SettingsWorkspaceProps {
  settings: UserSettings | null;
  language: StudyLanguage;
  onChangeLanguage: (lang: StudyLanguage) => void;
  examFocus: ExamFocus;
  onChangeExamFocus: (focus: ExamFocus) => void;
  explanationDepth: ExplanationDepth;
  onChangeExplanationDepth: (depth: ExplanationDepth) => void;
  savedSessionCount: number;
  onOpenAuth: () => void;
}

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  settings,
  language,
  onChangeLanguage,
  examFocus,
  onChangeExamFocus,
  explanationDepth,
  onChangeExplanationDepth,
  savedSessionCount,
  onOpenAuth,
}) => {
  const { user, resendVerificationEmail, refreshAuthUser, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(
    settings?.displayName || user?.displayName || 'Student'
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(settings?.displayName || user?.displayName || 'Student');
  }, [settings?.displayName, user?.displayName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    if (!user) {
      onOpenAuth();
      return;
    }

    if (!user.emailVerified) {
      setError('Please verify your email address first before syncing settings to the cloud.');
      return;
    }

    setSaving(true);
    try {
      await saveUserSettings(user.uid, {
        displayName: displayName.trim() || 'Student',
        preferredLanguage: language,
        examFocus,
        explanationDepth,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    try {
      await resendVerificationEmail();
      setVerificationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification email.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="pb-5 border-b border-[#E9E5F5]">
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-[#18122B]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[#645C7A]">
            Manage your student profile, default study language, exam focus, and account authentication.
          </p>
        </div>

        {/* Account & Auth Section */}
        <section className="rounded-2xl border border-[#E9E5F5] bg-[#FAF9FC] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#18122B]">
                Student Account
              </h2>
              <p className="text-xs text-[#645C7A] mt-0.5">
                {user
                  ? `${user.email} · ${savedSessionCount} saved sessions`
                  : 'Sign in with Google or Email to sync your study history across devices.'}
              </p>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#E9E5F5] bg-white px-4 py-2 text-xs font-medium text-[#3D3456] hover:bg-[#F7F5FC] transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-medium text-white hover:bg-[#5B21B6] transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {user && !user.emailVerified && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Email verification required for cloud history</p>
                  <p className="mt-0.5 text-amber-800">
                    Check your inbox for a verification link sent to {user.email}. Once clicked, tap Refresh Status below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  className="min-h-[38px] rounded-lg bg-white border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  {verificationSent ? 'Verification Email Sent' : 'Resend Verification Link'}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshAuthUser()}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>
          )}

          {user && user.emailVerified && (
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Account verified · Cloud history sync is active</span>
            </div>
          )}
        </section>

        {/* App Installation Card */}
        <section className="rounded-2xl border border-[#E9E5F5] bg-[#FAF9FC] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#18122B]">
              Install Scorer&apos;s Study AI
            </h2>
            <p className="text-xs text-[#645C7A] mt-0.5">
              Add Scorer&apos;s Study AI to your home screen for fast, full-screen access.
            </p>
          </div>
          <PWAInstallButton variant="settings" />
        </section>

        {/* Study Preferences Form */}
        <form onSubmit={handleSave} className="rounded-2xl border border-[#E9E5F5] bg-white p-5 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#18122B]">
            Study Preferences
          </h2>

          <div>
            <label htmlFor="pref-name" className="block text-xs font-medium text-[#3D3456] mb-1.5">
              Display Name
            </label>
            <input
              id="pref-name"
              type="text"
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3.5 text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pref-language" className="block text-xs font-medium text-[#3D3456] mb-1.5">
                Default Study Language
              </label>
              <select
                id="pref-language"
                value={language}
                onChange={(e) => onChangeLanguage(e.target.value as StudyLanguage)}
                className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3 text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
              >
                <option value="english">English</option>
                <option value="hausa">Hausa</option>
                <option value="bilingual">Bilingual (English + Hausa)</option>
              </select>
            </div>

            <div>
              <label htmlFor="pref-exam" className="block text-xs font-medium text-[#3D3456] mb-1.5">
                Target Exam / Curriculum
              </label>
              <select
                id="pref-exam"
                value={examFocus}
                onChange={(e) => onChangeExamFocus(e.target.value as ExamFocus)}
                className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white px-3 text-sm text-[#18122B] focus:border-[#6D28D9] focus:outline-none cursor-pointer"
              >
                <option value="general">General Study</option>
                <option value="jamb">JAMB / UTME</option>
                <option value="waec">WAEC / NECO</option>
                <option value="university">Nigerian University</option>
                <option value="coding">Coding & Tech</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3D3456] mb-2">
              Explanation Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'step-by-step',
                    title: 'Step-by-Step Tutor',
                    desc: 'Full workings, formulas, and exam tips',
                  },
                  {
                    id: 'concise',
                    title: 'Concise Quick Review',
                    desc: 'Direct, high-speed revision answers',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeExplanationDepth(opt.id)}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                    explanationDepth === opt.id
                      ? 'border-[#6D28D9] bg-[#FAF8FF]'
                      : 'border-[#E9E5F5] bg-white hover:bg-[#FAF9FC]'
                  }`}
                >
                  <div className="text-sm font-medium text-[#18122B]">{opt.title}</div>
                  <div className="text-xs text-[#645C7A] mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-[#645C7A]">
              AI engine connected securely via server environment
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-2 text-sm font-medium text-white hover:bg-[#5B21B6] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
