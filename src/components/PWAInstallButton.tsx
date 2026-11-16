import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'compact' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const buttonNode =
    variant === 'compact' ? (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        aria-label="Install Scorer's Study AI"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install</span>
      </button>
    ) : variant === 'settings' ? (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? 'Install App' : isIOS ? 'Install on iPhone / iPad' : 'Install App'}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );

  return (
    <>
      {buttonNode}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18122B]/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-[#E9E5F5] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute right-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#645C7A] hover:bg-[#F7F5FC] hover:text-[#18122B] cursor-pointer"
              aria-label="Close install instructions"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5" />
            </div>

            <h3 id="pwa-install-guide-title" className="font-display text-lg font-semibold text-[#18122B]">
              Install Scorer&apos;s Study AI
            </h3>

            {isIOS ? (
              <ol className="mt-3 space-y-2 text-sm text-[#3D3456] leading-relaxed list-decimal pl-5">
                <li>
                  Tap the <span className="inline-flex items-center gap-1 font-semibold text-[#18122B]"><Share className="w-3.5 h-3.5" /> Share</span> button in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong className="text-[#18122B]">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-[#18122B]">Add</strong> to launch Scorer&apos;s Study AI like a native app.
                </li>
              </ol>
            ) : (
              <div className="mt-3 space-y-2.5 text-sm text-[#3D3456] leading-relaxed">
                <p>
                  To install on Android or Desktop Chrome:
                </p>
                <ol className="space-y-1.5 list-decimal pl-5">
                  <li>Open this page directly in Chrome (outside an embedded preview frame).</li>
                  <li>
                    Tap the browser menu (<strong className="text-[#18122B]">⋮</strong>) or address bar install icon and choose <strong className="text-[#18122B]">Install app</strong>.
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const accepted = await install();
                    if (accepted) setShowGuide(false);
                  }}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  Install Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-[#F7F5FC] px-4 py-2 text-sm font-medium text-[#3D3456] hover:bg-[#EDE9FE] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
