interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A reliable in-app confirm dialog (window.confirm freezes inside WKWebView). */
export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = true, busy, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 w-full max-w-[320px] shadow-2xl text-center">
        <h3 className="font-black text-lg text-neutral-800 mb-1">{title}</h3>
        {message && <p className="text-sm text-neutral-500 mb-5">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-2xl font-bold text-neutral-600 bg-neutral-100 active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-3 rounded-2xl font-bold text-white active:scale-95 transition-transform disabled:opacity-60 ${danger ? 'bg-red-500' : 'bg-teal-500'}`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
