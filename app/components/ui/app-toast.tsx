interface AppToastProps {
  message: string;
  type?: "success" | "error" | "info";
}

export function AppToast({
  message,
  type = "success",
}: AppToastProps) {
  const toneClass =
    type === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : type === "error"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
        : "border-white/10 bg-white/[0.06] text-white/80";

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm ${toneClass}`}
    >
      {message}
    </div>
  );
}