"use client";

import { type ReactNode, useEffect } from "react";

export function Modal({
  open,
  title,
  description,
  onClose,
  size = "lg",
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const sizeClass =
    size === "sm"
      ? "max-w-lg"
      : size === "md"
        ? "max-w-2xl"
        : size === "xl"
          ? "max-w-6xl"
          : "max-w-4xl";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 max-h-[calc(100vh-4rem)] w-full overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_35px_90px_rgba(15,23,42,0.22)] ${sizeClass}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 id="modal-title" className="text-2xl font-semibold text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
