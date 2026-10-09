import React from 'react';

export interface ToastItem {
  id: string;
  message: string;
  icon: string;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1c211e]/95 backdrop-blur-xl border border-[#4edea3]/40 shadow-[0_10px_35px_rgba(0,0,0,0.8)] text-[#dfe4e0] text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
        >
          <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
            {t.icon || 'check_circle'}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
};
