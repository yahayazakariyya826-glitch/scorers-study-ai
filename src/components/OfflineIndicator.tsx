import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700" />
      <span>Offline Mode — Cached app shell active</span>
    </div>
  );
};
