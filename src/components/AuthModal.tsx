import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState(false);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name to create your account.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#18122B]/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white border border-[#E9E5F5] shadow-2xl grid grid-cols-1 md:grid-cols-12">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#645C7A] hover:bg-[#F7F5FC] hover:text-[#18122B] transition-colors cursor-pointer"
          aria-label="Close sign in dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Editorial Academic Panel (desktop) */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#F7F5FC] border-r border-[#E9E5F5] p-6">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/src/assets/images/scorer_emblem_1794823384390.jpg"
                alt="Scorer's Study AI emblem"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-[#E9E5F5] bg-white"
              />
              <div>
                <p className="font-display font-semibold text-sm text-[#18122B]">Scorer's Study AI</p>
                <p className="text-xs text-[#645C7A]">Score Higher, Study Smarter</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#E9E5F5] bg-white aspect-[16/10]">
              {!bannerError ? (
                <img
                  src="/src/assets/images/study_academic_banner_1794823384706.jpg"
                  alt="Organized study desk with purple textbook"
                  referrerPolicy="no-referrer"
                  onError={() => setBannerError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#F3F0FA] text-[#6D28D9] p-4">
                  <BookOpen className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium text-center">Nigerian Exam & Study Companion</span>
                </div>
              )}
            </div>

            <h3 className="mt-5 font-display text-lg font-semibold text-[#18122B] leading-snug">
              Save your study sessions across devices
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#645C7A]">
              Keep your English & Hausa explanations, textbook solutions, and Lovable/Bolt app prompts synced in your personal study library.
            </p>
          </div>

          <p className="text-xs text-[#645C7A]">
            WAEC · JAMB UTME · NECO · University
          </p>
        </div>

        {/* Right Auth Form */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          <h2 id="auth-modal-title" className="font-display text-xl font-semibold text-[#18122B]">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your student account'}
          </h2>
          <p className="mt-1 text-sm text-[#645C7A]">
            Access saved chat history and study preferences anywhere.
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="mt-5 w-full min-h-[46px] flex items-center justify-center gap-3 rounded-xl border border-[#DDD6FE] bg-white px-4 py-2.5 text-sm font-medium text-[#18122B] hover:bg-[#FAF8FF] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-[#645C7A]">
            <div className="h-px flex-1 bg-[#E9E5F5]" />
            <span>or use email</span>
            <div className="h-px flex-1 bg-[#E9E5F5]" />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F7F5FC] rounded-xl mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'signin' ? 'bg-white text-[#18122B] shadow-xs' : 'text-[#645C7A] hover:text-[#18122B]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'signup' ? 'bg-white text-[#18122B] shadow-xs' : 'text-[#645C7A] hover:text-[#18122B]'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#3D3456] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#645C7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amina Bello"
                    className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white pl-10 pr-3.5 text-sm text-[#18122B] placeholder:text-[#9890AC] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#3D3456] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#645C7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu.ng"
                  autoComplete="email"
                  className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white pl-10 pr-3.5 text-sm text-[#18122B] placeholder:text-[#9890AC] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#3D3456] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#645C7A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full min-h-[44px] rounded-xl border border-[#E9E5F5] bg-white pl-10 pr-3.5 text-sm text-[#18122B] placeholder:text-[#9890AC] focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5B21B6] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
            >
              <span>{submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In with Email' : 'Create Account'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
