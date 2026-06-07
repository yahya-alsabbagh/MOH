import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KeyRound, ShieldCheck, X } from "lucide-react";

type Props = {
  onRenewSuccess: () => Promise<void> | void;
};

export default function BackdoorModal({ onRenewSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [maxRuns, setMaxRuns] = useState("10");
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState("60");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.altKey && event.code === "Digit9") {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const close = () => {
    setIsOpen(false);
    setError("");
    setPassword("");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await invoke("renew_license_backdoor", {
        password,
        maxRuns: Number(maxRuns) || 10,
        maxRuntimeMinutes: Number(maxRuntimeMinutes) || 60,
      });
      await onRenewSuccess();
      close();
    } catch (err: any) {
      console.error(err);
      let msg = "تعذر إتمام العملية.";
      if (typeof err === "string") msg = err;
      else if (err instanceof Error) msg = err.message;
      else if (err && err.message) msg = err.message;
      else msg = JSON.stringify(err);
      
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold">لوحة التحكم الأمنية</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-slate-300 transition hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">كلمة المرور للمطور</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-10 py-2 text-sm outline-none ring-brand-600 transition focus:ring-2"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">الحد الأقصى لمرات التشغيل</span>
            <input
              type="number"
              min={1}
              value={maxRuns}
              onChange={(e) => setMaxRuns(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-brand-600 transition focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">الحد الأقصى لدقائق التشغيل لكل جلسة</span>
            <input
              type="number"
              min={1}
              value={maxRuntimeMinutes}
              onChange={(e) => setMaxRuntimeMinutes(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-brand-600 transition focus:ring-2"
              required
            />
          </label>

          {error && <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "جارٍ التنفيذ..." : "حفظ الإعدادات وتفعيل النظام"}
          </button>
        </form>
      </div>
    </div>
  );
}
