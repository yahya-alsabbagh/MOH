import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ScanSearch,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Brain,
  Eye,
} from "lucide-react";
import ConflictResolution from "./ConflictResolution";

interface Props {
  filePath: string;
  headers: string[];
}

type ResultState =
  | { kind: "idle" }
  | { kind: "success"; outputPath: string }
  | { kind: "error"; message: string };

// ── Fuzzy Matching Types ──────────────────────────────────
interface EmployeeSummary {
  raw_name: string;
  cleaned_name: string;
  raw_title: string;
  raw_grade: string;
  job_code: string;
  row_index: number;
}

interface FuzzyMatchResult {
  employee_1: EmployeeSummary;
  employee_2: EmployeeSummary;
  similarity_score: number;
  match_type: string;
}

interface ExactDuplicateGroup {
  cleaned_name: string;
  employees: EmployeeSummary[];
}

interface SmartScanResult {
  total_rows: number;
  exact_duplicates: ExactDuplicateGroup[];
  fuzzy_matches: FuzzyMatchResult[];
  scan_duration_ms: number;
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════
export default function DuplicateCheckerCard({ filePath, headers }: Props) {
  const [columnName, setColumnName] = useState<string>("");
  const [isSmartScanning, setIsSmartScanning] = useState(false);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  // Scan results
  const [smartResult, setSmartResult] = useState<SmartScanResult | null>(null);
  const [showConflictHub, setShowConflictHub] = useState(false);

  useEffect(() => {
    setResult({ kind: "idle" });
    setSmartResult(null);
  }, [filePath]);

  const isDisabled = !filePath;
  const isScanning = isSmartScanning;

  // ── Smart Fuzzy Scan ──
  const runSmartScan = async () => {
    if (!filePath || !columnName) {
      setResult({ kind: "error", message: !filePath ? "يرجى رفع الملف أولاً." : "يرجى اختيار عمود البحث." });
      return;
    }
    setIsSmartScanning(true);
    setResult({ kind: "idle" });
    try {
      const res = await invoke<SmartScanResult>("run_smart_duplicate_scan", {
        filePath, columnName, threshold: 0.90,
      });
      setSmartResult(res);
      setShowConflictHub(true);
    } catch (err: any) {
      setResult({ kind: "error", message: typeof err === "string" ? err : "تعذر إتمام الفحص الذكي." });
    } finally {
      setIsSmartScanning(false);
    }
  };

  return (
    <>
      <div
        className={`group relative overflow-hidden flex flex-col rounded-xl border bg-white p-5 shadow-card transition-all duration-300
          ${isDisabled
            ? "border-slate-100 opacity-50"
            : "border-slate-200 hover:border-navy-200 hover:shadow-card-hover"
          }`}
      >
        {/* Loading Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px]">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full shadow-inner bg-navy-50">
              <Loader2 className="h-6 w-6 animate-spin text-navy-600" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              جاري الفحص الذكي...
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              تحليل التشابه على جميع أنوية المعالج
            </p>
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
            <p className="text-xs text-slate-400">اكتشاف القيم المكررة والأسماء المتشابهة</p>
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
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto flex flex-col gap-2">
            {/* Smart Fuzzy Scan */}
            <button
              type="button"
              onClick={runSmartScan}
              disabled={isDisabled || isScanning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-l from-violet-600 to-indigo-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:from-violet-500 hover:to-indigo-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
            >
              {isSmartScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {isSmartScanning ? "جارٍ التحليل الذكي..." : "فحص التكرار الذكي"}
            </button>

            {/* Show Last Results */}
            {smartResult && !showConflictHub && (
              <button
                type="button"
                onClick={() => setShowConflictHub(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-all duration-200 hover:bg-indigo-100 active:scale-95"
              >
                <Eye className="h-3.5 w-3.5" />
                عرض آخر نتائج الفحص
              </button>
            )}
          </div>

          {/* Result Messages */}
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

      {/* Conflict Resolution Hub */}
      {smartResult && (
        <ConflictResolution
          isOpen={showConflictHub}
          onClose={() => setShowConflictHub(false)}
          result={smartResult}
          filePath={filePath}
        />
      )}
    </>
  );
}
