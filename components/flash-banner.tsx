export function FlashBanner({
  type,
  message,
}: {
  type?: string;
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`rounded-[1.5rem] border px-5 py-4 text-sm ${
        type === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </div>
  );
}
