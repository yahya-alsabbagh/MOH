import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BadgeCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface Props {
  workFilePath: string;
  headers: string[];
}

type ResultState =
  | { kind: "idle" }
  | { kind: "success"; outputPath: string }
  | { kind: "error"; message: string };

export default function TitleValidatorCard({ workFilePath, headers }: Props) {
  const [titleCol, setTitleCol] = useState<string>("");
  const [gradeCol, setGradeCol] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  const isDisabled = !workFilePath;

  // We don't need to fetch reference data to display the count anymore as requested by user.

  const run = async () => {
    setResult({ kind: "idle" });
    if (!workFilePath) {
      setResult({ kind: "error", message: "يرجى رفع الملف أولاً من الأعلى." });
      return;
    }
    if (!titleCol || !gradeCol) {
      setResult({ kind: "error", message: "يرجى اختيار عمودي العنوان والدرجة." });
      return;
    }
    setIsProcessing(true);
    try {
      const outputPath = await invoke<string>("run_title_validation", {
        workFile: workFilePath,
        titleCol: titleCol,
        gradeCol: gradeCol,
      });
      setResult({ kind: "success", outputPath });
    } catch (err: any) {
      setResult({
        kind: "error",
        message:
          typeof err === "string" ? err : (err?.message ?? "تعذر إتمام التدقيق."),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`group relative overflow-hidden flex flex-col rounded-xl border bg-white p-5 shadow-card transition-all duration-300
        ${isDisabled
          ? "border-slate-100 opacity-50"
          : "border-slate-200 hover:border-indigo-200 hover:shadow-card-hover"
        }`}
    >
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 shadow-inner">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
          <p className="text-sm font-bold text-slate-800">جاري المعالجة...</p>
          <p className="mt-1 text-xs font-medium text-slate-500">يتم بناء الإكسل النهائي</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300
            ${isDisabled ? "bg-slate-100" : "bg-indigo-50 group-hover:bg-indigo-100"}`}
        >
          <BadgeCheck
            className={`h-5 w-5 transition-colors duration-300
              ${isDisabled ? "text-slate-300" : "text-indigo-700"}`}
          />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">تدقيق العناوين الوظيفية</h3>
          <p className="text-xs text-slate-400">مطابقة الدرجات مع النظام المدمج</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        
        {/* Column Selectors */}
        <div className="grid grid-cols-2 gap-2">
          {/* Title Column */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">
              عمود العنوان الوظيفي
            </label>
            <div className="relative">
              <select
                disabled={isDisabled || headers.length === 0}
                value={titleCol}
                onChange={(e) => {
                  setTitleCol(e.target.value);
                  setResult({ kind: "idle" });
                }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 pr-7 text-xs text-slate-700 transition-all duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">— اختر —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Grade Column */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">
              عمود الدرجة الوظيفية
            </label>
            <div className="relative">
              <select
                disabled={isDisabled || headers.length === 0}
                value={gradeCol}
                onChange={(e) => {
                  setGradeCol(e.target.value);
                  setResult({ kind: "idle" });
                }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 pr-7 text-xs text-slate-700 transition-all duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">— اختر —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Run Button */}
        <button
          type="button"
          onClick={run}
          disabled={isDisabled || isProcessing}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-indigo-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BadgeCheck className="h-4 w-4" />
          )}
          {isProcessing ? "جارٍ التدقيق..." : "بدء التدقيق التلقائي"}
        </button>

        {/* Result */}
        {result.kind === "success" && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="mb-0.5 font-bold">تم التدقيق بنجاح ✓</div>
              <div className="break-all text-emerald-700">{result.outputPath}</div>
            </div>
          </div>
        )}
        {result.kind === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
            <span className="font-medium">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
