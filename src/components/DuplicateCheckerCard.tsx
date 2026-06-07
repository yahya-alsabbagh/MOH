import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ScanSearch,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Props {
  filePath: string;
  headers: string[];
}

type ResultState =
  | { kind: "idle" }
  | { kind: "success"; outputPath: string }
  | { kind: "error"; message: string };

export default function DuplicateCheckerCard({ filePath, headers }: Props) {
  const [columnName, setColumnName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  const isDisabled = !filePath;

  const run = async () => {
    setResult({ kind: "idle" });
    if (!filePath) {
      setResult({ kind: "error", message: "يرجى رفع الملف أولاً من الأعلى." });
      return;
    }
    if (!columnName) {
      setResult({ kind: "error", message: "يرجى اختيار عمود البحث عن التكرار." });
      return;
    }
    setIsProcessing(true);
    try {
      const outputPath = await invoke<string>("run_duplicate_check", {
        filePath,
        columnName,
      });
      setResult({ kind: "success", outputPath });
    } catch (err: any) {
      setResult({
        kind: "error",
        message:
          typeof err === "string" ? err : (err?.message ?? "تعذر إتمام الفحص."),
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
          : "border-slate-200 hover:border-navy-200 hover:shadow-card-hover"
        }`}
    >
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 shadow-inner">
            <Loader2 className="h-6 w-6 animate-spin text-navy-600" />
          </div>
          <p className="text-sm font-bold text-slate-800">جاري فحص التكرارات...</p>
          <p className="mt-1 text-xs font-medium text-slate-500">يتم بناء الإكسل النهائي</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300
            ${isDisabled ? "bg-slate-100" : "bg-navy-50 group-hover:bg-navy-100"}`}
        >
          <ScanSearch
            className={`h-5 w-5 transition-colors duration-300
              ${isDisabled ? "text-slate-300" : "text-navy-700"}`}
          />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">فحص التكرارات</h3>
          <p className="text-xs text-slate-400">اكتشاف القيم والأسماء المكررة</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {/* Column Selector */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            عمود البحث عن التكرار
          </label>
          <div className="relative">
            <select
              disabled={isDisabled || headers.length === 0}
              value={columnName}
              onChange={(e) => {
                setColumnName(e.target.value);
                setResult({ kind: "idle" });
              }}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-700 transition-all duration-200 focus:border-navy-400 focus:ring-2 focus:ring-navy-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">— اختر العمود —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Run Button */}
        <button
          type="button"
          onClick={run}
          disabled={isDisabled || isProcessing}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-navy-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="h-4 w-4" />
          )}
          {isProcessing ? "جارٍ الفحص..." : "بدء فحص التكرارات"}
        </button>

        {/* Result */}
        {result.kind === "success" && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="mb-0.5 font-bold">تم الاستخراج بنجاح ✓</div>
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
