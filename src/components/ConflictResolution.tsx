import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Brain,
  X,
  Users,
  Zap,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Loader2,
  Flag,
  EyeOff,
  BarChart3,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────
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

type Decision = "fraud" | "ignore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: SmartScanResult;
  filePath: string;
}

// ── Diff Highlighting ─────────────────────────────────────
function renderDiffName(name1: string, name2: string, isFirst: boolean) {
  const source = isFirst ? name1 : name2;
  const compare = isFirst ? name2 : name1;
  const srcChars = [...source];
  const cmpChars = [...compare];

  return (
    <span>
      {srcChars.map((ch, i) => {
        const isDiff = i >= cmpChars.length || ch !== cmpChars[i];
        return (
          <span
            key={i}
            className={
              isDiff
                ? "bg-rose-200 text-rose-800 rounded-sm px-[1px] font-black"
                : ""
            }
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

// ── Score helpers ──────────────────────────────────────────
function scoreBarColor(score: number): string {
  if (score >= 95) return "bg-rose-500";
  if (score >= 90) return "bg-amber-500";
  return "bg-sky-500";
}
function scoreBadgeStyle(score: number): string {
  if (score >= 95) return "bg-rose-100 text-rose-700 ring-rose-300";
  if (score >= 90) return "bg-amber-100 text-amber-700 ring-amber-300";
  return "bg-sky-100 text-sky-700 ring-sky-300";
}
function scoreLabel(score: number): string {
  if (score === 100) return "🔴 تطابق تام";
  if (score >= 95) return "🔴 تشابه عالي جداً";
  if (score >= 90) return "🟠 تشابه عالي";
  return "🟡 تشابه متوسط";
}

const decisionArabic: Record<Decision, string> = {
  fraud: "تلاعب",
  ignore: "تجاهل",
};

// ═══════════════════════════════════════════════════════════
// ConflictResolution Component
// ═══════════════════════════════════════════════════════════
export default function ConflictResolution({ isOpen, onClose, result, filePath }: Props) {
  const [decisions, setDecisions] = useState<Map<number, Decision>>(new Map());
  const [fadingCards, setFadingCards] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  // Reset when modal opens with new results
  useEffect(() => {
    if (isOpen) {
      setDecisions(new Map());
      setFadingCards(new Set());
      setExpandedGroups(new Set());
      setSearchQuery("");
      setExportMsg(null);
      setShowResolved(false);
    }
  }, [isOpen, result]);

  const makeDecision = useCallback((index: number, decision: Decision) => {
    // Start fade animation
    setFadingCards((prev) => new Set(prev).add(index));
    // After animation, record decision
    setTimeout(() => {
      setDecisions((prev) => new Map(prev).set(index, decision));
      setFadingCards((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 450);
  }, []);

  const undoDecision = useCallback((index: number) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const toggleGroup = (idx: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Export ──
  const handleExport = async () => {
    setIsExporting(true);
    setExportMsg(null);
    try {
      // Build decisions array parallel to fuzzy_matches
      const decisionsArr = result.fuzzy_matches.map((_, i) => {
        const d = decisions.get(i);
        return d ? decisionArabic[d] : "";
      });

      const outputPath = await invoke<string>("export_smart_scan_excel", {
        sourceFilePath: filePath,
        scanResult: result,
        decisions: decisionsArr,
      });
      setExportMsg(outputPath);
    } catch (err: any) {
      setExportMsg("❌ " + (typeof err === "string" ? err : "فشل التصدير"));
    } finally {
      setIsExporting(false);
    }
  };

  // ── Filtering ──
  const pendingMatches = result.fuzzy_matches
    .map((m, i) => ({ match: m, index: i }))
    .filter(({ index }) => !decisions.has(index))
    .filter(({ match }) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        match.employee_1.raw_name.toLowerCase().includes(q) ||
        match.employee_2.raw_name.toLowerCase().includes(q)
      );
    });

  const resolvedMatches = result.fuzzy_matches
    .map((m, i) => ({ match: m, index: i }))
    .filter(({ index }) => decisions.has(index));

  const resolvedCount = decisions.size;
  const totalFuzzy = result.fuzzy_matches.length;
  const progressPct = totalFuzzy > 0 ? (resolvedCount / totalFuzzy) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        dir="rtl"
      >
        {/* ══════ Header ══════ */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-l from-indigo-50 via-white to-violet-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-200">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">مركز معالجة التعارض</h2>
              <p className="text-xs text-slate-500">مراجعة واتخاذ قرارات بشأن التطابقات المشبوهة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-500 hover:shadow-md disabled:opacity-50 active:scale-95"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {isExporting ? "جاري التصدير..." : "تصدير تقرير التكرار الشامل"}
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ══════ Stats Bar ══════ */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3 sm:grid-cols-5">
          {[
            { icon: Users, label: "إجمالي الصفوف", value: result.total_rows.toLocaleString(), ring: "ring-slate-100" },
            { icon: CheckCircle, label: "تطابق تام", value: result.exact_duplicates.length.toString(), ring: "ring-emerald-100" },
            { icon: Zap, label: "تشابه ضبابي", value: totalFuzzy.toString(), ring: "ring-amber-100" },
            { icon: BarChart3, label: "تم مراجعتها", value: `${resolvedCount}/${totalFuzzy}`, ring: "ring-indigo-100" },
            { icon: Clock, label: "مدة الفحص", value: result.scan_duration_ms < 1000 ? `${result.scan_duration_ms}ms` : `${(result.scan_duration_ms / 1000).toFixed(1)}s`, ring: "ring-violet-100" },
          ].map(({ icon: Icon, label, value, ring }) => (
            <div key={label} className={`flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ${ring}`}>
              <Icon className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-[9px] font-semibold uppercase text-slate-400">{label}</p>
                <p className="text-sm font-bold text-slate-800">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        {totalFuzzy > 0 && (
          <div className="border-b border-slate-100 bg-white px-6 py-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">تقدم المراجعة</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-indigo-500 to-violet-500 transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 whitespace-nowrap">{Math.round(progressPct)}%</span>
            </div>
          </div>
        )}

        {/* Export message */}
        {exportMsg && (
          <div className={`mx-6 mt-3 rounded-lg px-4 py-2 text-xs font-medium ${
            exportMsg.startsWith("❌")
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {exportMsg.startsWith("❌") ? exportMsg : (
              <><span className="font-bold">تم التصدير بنجاح ✓</span><span className="mr-2 break-all">{exportMsg}</span></>
            )}
          </div>
        )}

        {/* ══════ Scrollable Content ══════ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Exact Duplicates ── */}
          {result.exact_duplicates.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                التطابقات التامة ({result.exact_duplicates.length} مجموعة)
              </h3>
              <div className="space-y-2">
                {result.exact_duplicates.map((group, idx) => (
                  <div key={idx} className="overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/30">
                    <button
                      onClick={() => toggleGroup(idx)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-right transition-colors hover:bg-emerald-50"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">
                          {group.employees.length}
                        </span>
                        {group.cleaned_name}
                      </span>
                      {expandedGroups.has(idx) ? <ChevronUp className="h-4 w-4 text-emerald-500" /> : <ChevronDown className="h-4 w-4 text-emerald-500" />}
                    </button>
                    {expandedGroups.has(idx) && (
                      <div className="border-t border-emerald-100 bg-white">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-emerald-50/50 text-slate-500">
                            <th className="px-3 py-1.5 text-right font-semibold">الصف</th>
                            <th className="px-3 py-1.5 text-right font-semibold">الاسم الأصلي</th>
                            <th className="px-3 py-1.5 text-right font-semibold">العنوان</th>
                            <th className="px-3 py-1.5 text-right font-semibold">الدرجة</th>
                          </tr></thead>
                          <tbody>
                            {group.employees.map((emp, i) => (
                              <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                                <td className="px-3 py-1.5 font-mono text-slate-400">{emp.row_index}</td>
                                <td className="px-3 py-1.5 font-semibold text-slate-700">{emp.raw_name}</td>
                                <td className="px-3 py-1.5 text-slate-500">{emp.raw_title}</td>
                                <td className="px-3 py-1.5 text-slate-500">{emp.raw_grade}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Fuzzy Match Cards (Pending) ── */}
          {totalFuzzy > 0 && (
            <div>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Zap className="h-4 w-4 text-amber-500" />
                  التطابقات المعلّقة ({pendingMatches.length})
                </h3>
                {totalFuzzy > 0 && (
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-9 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 sm:w-56"
                    />
                  </div>
                )}
              </div>

              {pendingMatches.length === 0 && resolvedCount < totalFuzzy ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Search className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-500">لا توجد نتائج مطابقة للبحث</p>
                </div>
              ) : pendingMatches.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle className="h-7 w-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-emerald-700">تمت مراجعة جميع التطابقات الضبابية ✓</p>
                  <p className="mt-1 text-xs text-slate-500">يمكنك الآن تصدير التقرير الشامل</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {pendingMatches.map(({ match, index }) => {
                    const isFading = fadingCards.has(index);
                    return (
                      <div
                        key={index}
                        className={`overflow-hidden rounded-xl border shadow-sm transition-all duration-500 ease-out ${
                          isFading
                            ? "opacity-0 scale-95 max-h-0 border-transparent m-0 p-0"
                            : "opacity-100 scale-100 max-h-[500px] border-slate-200"
                        }`}
                      >
                        {/* Score Bar */}
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-2 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-600">
                            {scoreLabel(match.similarity_score)}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${scoreBadgeStyle(match.similarity_score)}`}>
                            {match.similarity_score.toFixed(1)}%
                          </span>
                        </div>
                        {/* Score progress bar */}
                        <div className="h-1 bg-slate-100">
                          <div className={`h-full transition-all ${scoreBarColor(match.similarity_score)}`} style={{ width: `${match.similarity_score}%` }} />
                        </div>

                        {/* Side-by-side comparison */}
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          {[match.employee_1, match.employee_2].map((emp, side) => (
                            <div key={side} className={`p-3 ${side === 1 ? "bg-slate-50/50" : ""}`}>
                              <p className="text-[10px] font-semibold text-slate-400 mb-1">
                                {side === 0 ? "الموظف الأول" : "الموظف الثاني"} • صف {emp.row_index}
                              </p>
                              <p className="text-sm font-bold text-slate-800 leading-relaxed">
                                {renderDiffName(
                                  match.employee_1.raw_name,
                                  match.employee_2.raw_name,
                                  side === 0
                                )}
                              </p>
                              {emp.raw_title && (
                                <p className="mt-1.5 text-[11px] text-slate-500">
                                  <span className="text-slate-400">العنوان:</span> {emp.raw_title}
                                </p>
                              )}
                              {emp.raw_grade && (
                                <p className="text-[11px] text-slate-500">
                                  <span className="text-slate-400">الدرجة:</span> {emp.raw_grade}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
                          <button
                            onClick={() => makeDecision(index, "fraud")}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-rose-500 hover:shadow-md active:scale-95"
                          >
                            <Flag className="h-3.5 w-3.5" />
                            تلاعب
                          </button>
                          <button
                            onClick={() => makeDecision(index, "ignore")}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-400 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-slate-500 hover:shadow-md active:scale-95"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            تجاهل
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Resolved Decisions ── */}
          {resolvedCount > 0 && (
            <div>
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-right transition hover:bg-slate-100"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  القرارات المتخذة ({resolvedCount})
                </span>
                {showResolved ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {showResolved && (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr className="text-slate-500">
                        <th className="px-3 py-2 text-right font-semibold">الموظف الأول</th>
                        <th className="px-3 py-2 text-right font-semibold">الموظف الثاني</th>
                        <th className="px-3 py-2 text-center font-semibold">التشابه</th>
                        <th className="px-3 py-2 text-center font-semibold">القرار</th>
                        <th className="px-3 py-2 text-center font-semibold">تراجع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedMatches.map(({ match, index }) => {
                        const dec = decisions.get(index)!;
                        const decStyle = dec === "fraud"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-600";
                        return (
                          <tr key={index} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-semibold text-slate-700">{match.employee_1.raw_name}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{match.employee_2.raw_name}</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-600">{match.similarity_score.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${decStyle}`}>
                                {decisionArabic[dec]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => undoDecision(index)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition"
                              >
                                تراجع
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Empty State ── */}
          {result.exact_duplicates.length === 0 && totalFuzzy === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700">الملف نظيف تماماً ✓</h3>
              <p className="mt-1 text-sm text-slate-500">لم يتم اكتشاف أي تطابقات</p>
            </div>
          )}
        </div>

        {/* ══════ Footer ══════ */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-300"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
