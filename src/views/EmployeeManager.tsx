import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Users,
  Trash2,
  ShieldAlert,
  Loader2,
  Database,
  AlertTriangle,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Landmark,
  Hash,
  Download,
  Filter,
  X,
  Copy,
  Globe,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface EmployeeSummary {
  ministry: string;
  directorate: string;
  approval_year: number;
  employee_count: number;
}

interface EmployeeRecord {
  id: number;
  row_number: number | null;
  original_name: string;
  normalized_name: string;
  audit_status: string;
  data_columns: Record<string, unknown>;
}

interface DuplicateGroup {
  normalized_name: string;
  count: number;
}

interface EmployeeDetailsResponse {
  records: EmployeeRecord[];
  total_records: number;
  page: number;
  page_size: number;
  all_columns: string[];
  duplicate_names: DuplicateGroup[];
}

interface GlobalSearchOccurrence {
  ministry: string;
  directorate: string;
  approval_year: number;
  original_name: string;
  row_number: number | null;
  data_columns: Record<string, unknown>;
}

interface GlobalSearchResult {
  normalized_name: string;
  occurrences: GlobalSearchOccurrence[];
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function EmployeeManager({
  isDeleteUnlocked = false,
}: {
  isDeleteUnlocked?: boolean;
}) {
  // ── Summary State ───────────────────────────────────────────
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Global name search ──────────────────────────────────────
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[] | null>(null);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);

  // ── Details State ───────────────────────────────────────────
  const [selectedDataset, setSelectedDataset] =
    useState<EmployeeSummary | null>(null);
  const [details, setDetails] = useState<EmployeeDetailsResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsPage, setDetailsPage] = useState(0);
  const PAGE_SIZE = 50;

  // ── Search in details ───────────────────────────────────────
  const [detailSearchColumn, setDetailSearchColumn] = useState("original_name");
  const [detailSearchTerm, setDetailSearchTerm] = useState("");
  const [activeSearchColumn, setActiveSearchColumn] = useState<string | undefined>(undefined);
  const [activeSearchTerm, setActiveSearchTerm] = useState<string | undefined>(undefined);

  // ── Export ──────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  // ── Duplicate set (for highlighting) ────────────────────────
  const duplicateNamesSet = useMemo(() => {
    if (!details) return new Set<string>();
    return new Set(details.duplicate_names.map((d) => d.normalized_name));
  }, [details]);

  // ── Fetch summaries ─────────────────────────────────────────
  const fetchSummary = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = await invoke<EmployeeSummary[]>("fetch_employees_summary");
      setSummaries(data);
    } catch (err: unknown) {
      console.error("Failed to fetch employee summary:", err);
      setErrorMsg(
        typeof err === "string" ? err : "فشل في جلب بيانات الموظفين"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // ── Fetch details ───────────────────────────────────────────
  const fetchDetails = useCallback(async (
    summary: EmployeeSummary,
    page: number = 0,
    searchCol?: string,
    searchVal?: string,
  ) => {
    setIsLoadingDetails(true);
    try {
      const data = await invoke<EmployeeDetailsResponse>(
        "fetch_employee_details",
        {
          ministry: summary.ministry,
          directorate: summary.directorate,
          approvalYear: summary.approval_year,
          page,
          pageSize: PAGE_SIZE,
          searchColumn: searchCol || null,
          searchTerm: searchVal || null,
        }
      );
      setDetails(data);
      setDetailsPage(page);
    } catch (err: unknown) {
      console.error("Failed to fetch employee details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const handleOpenDetails = (summary: EmployeeSummary) => {
    setSelectedDataset(summary);
    setDetailsPage(0);
    setDetailSearchColumn("original_name");
    setDetailSearchTerm("");
    setActiveSearchColumn(undefined);
    setActiveSearchTerm(undefined);
    fetchDetails(summary, 0);
  };

  const handleCloseDetails = () => {
    setSelectedDataset(null);
    setDetails(null);
    setDetailsPage(0);
    setDetailSearchTerm("");
    setActiveSearchColumn(undefined);
    setActiveSearchTerm(undefined);
  };

  // ── Search within details ───────────────────────────────────
  const handleDetailSearch = () => {
    if (!selectedDataset) return;
    if (detailSearchTerm.trim() === "") {
      handleClearSearch();
    } else {
      setActiveSearchColumn(detailSearchColumn);
      setActiveSearchTerm(detailSearchTerm);
      fetchDetails(selectedDataset, 0, detailSearchColumn, detailSearchTerm);
    }
  };

  const handleClearSearch = () => {
    setDetailSearchTerm("");
    setActiveSearchColumn(undefined);
    setActiveSearchTerm(undefined);
    if (selectedDataset) fetchDetails(selectedDataset, 0);
  };

  // ── Global name search ──────────────────────────────────────
  const handleGlobalSearch = async () => {
    if (globalSearchTerm.trim() === "") {
      setGlobalResults(null);
      return;
    }
    setIsGlobalSearching(true);
    try {
      const results = await invoke<GlobalSearchResult[]>(
        "search_employees_globally",
        { searchTerm: globalSearchTerm }
      );
      setGlobalResults(results);
    } catch (err) {
      console.error("Global search failed:", err);
    } finally {
      setIsGlobalSearching(false);
    }
  };

  const handleClearGlobalSearch = () => {
    setGlobalSearchTerm("");
    setGlobalResults(null);
  };

  // ── Export (visible data only) ──────────────────────────────
  const handleExport = async () => {
    if (!selectedDataset) return;
    const outputPath = await save({
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
      defaultPath: `موظفين_${selectedDataset.directorate}_${selectedDataset.approval_year}.xlsx`,
    });
    if (!outputPath) return;

    setIsExporting(true);
    try {
      await invoke("export_employees_to_excel", {
        outputPath,
        ministry: selectedDataset.ministry,
        directorate: selectedDataset.directorate,
        approvalYear: selectedDataset.approval_year,
        searchColumn: activeSearchColumn || null,
        searchTerm: activeSearchTerm || null,
        page: detailsPage,
        pageSize: PAGE_SIZE,
      });
    } catch (err: unknown) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (summary: EmployeeSummary) => {
    if (!isDeleteUnlocked) return;
    const confirmMsg = `هل أنت متأكد من حذف جميع سجلات موظفي (${summary.directorate}) التابعة لـ (${summary.ministry}) لسنة ${summary.approval_year}?\n\nسيتم مسح ${summary.employee_count} سجل ولا يمكن التراجع عن هذا الإجراء!`;
    const isConfirmed = await confirm(confirmMsg, {
      title: "تأكيد حذف بيانات الموظفين",
      kind: "warning",
    });
    if (!isConfirmed) return;
    const id = `${summary.ministry}-${summary.directorate}-${summary.approval_year}`;
    setDeletingId(id);
    setErrorMsg("");
    try {
      await invoke("delete_employee_dataset", {
        ministry: summary.ministry,
        directorate: summary.directorate,
        approvalYear: summary.approval_year,
      });
      await fetchSummary();
      if (
        selectedDataset?.ministry === summary.ministry &&
        selectedDataset?.directorate === summary.directorate &&
        selectedDataset?.approval_year === summary.approval_year
      ) {
        handleCloseDetails();
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(typeof err === "string" ? err : "تعذر حذف بيانات الموظفين");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtered summaries ──────────────────────────────────────
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return summaries;
    const query = searchQuery.toLowerCase();
    return summaries.filter(
      (s) =>
        s.ministry.toLowerCase().includes(query) ||
        s.directorate.toLowerCase().includes(query)
    );
  }, [summaries, searchQuery]);

  // ── Pagination ──────────────────────────────────────────────
  const totalPages = details ? Math.ceil(details.total_records / PAGE_SIZE) : 0;

  const searchColumnOptions = useMemo(() => {
    const opts = [{ value: "original_name", label: "الاسم" }];
    if (details) {
      for (const col of details.all_columns) {
        opts.push({ value: col, label: col });
      }
    }
    return opts;
  }, [details]);

  // ═══════════════════════════════════════════════════════════════
  // DETAILS VIEW
  // ═══════════════════════════════════════════════════════════════
  if (selectedDataset && details) {
    const totalDuplicates = details.duplicate_names.reduce((sum, d) => sum + d.count, 0);

    return (
      <div className="flex h-full flex-col p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseDetails}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-800">تفاصيل الموظفين</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Landmark className="h-3 w-3" />{selectedDataset.ministry}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{selectedDataset.directorate}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />{selectedDataset.approval_year}
                </span>
                <span className="flex items-center gap-1 font-bold text-indigo-600">
                  <Hash className="h-3 w-3" />{details.total_records} موظف
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تصدير المعروض
          </button>
        </div>

        {/* Duplicate alert */}
        {details.duplicate_names.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-bold text-amber-800">
              <Copy className="h-4 w-4" />
              تنبيه: تم اكتشاف {details.duplicate_names.length} اسم مكرر ({totalDuplicates} سجل)
            </div>
            <div className="flex flex-wrap gap-2">
              {details.duplicate_names.slice(0, 10).map((d) => (
                <span
                  key={d.normalized_name}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                >
                  {d.normalized_name}
                  <span className="rounded bg-amber-200 px-1 text-[10px] font-bold">{d.count}×</span>
                </span>
              ))}
              {details.duplicate_names.length > 10 && (
                <span className="text-xs text-amber-700 font-semibold">
                  +{details.duplicate_names.length - 10} أسماء أخرى...
                </span>
              )}
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <Filter className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={detailSearchColumn}
              onChange={(e) => setDetailSearchColumn(e.target.value)}
              className="h-10 appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {searchColumnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث..."
              value={detailSearchTerm}
              onChange={(e) => setDetailSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDetailSearch()}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            onClick={handleDetailSearch}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-700"
          >
            <Search className="h-3.5 w-3.5" />بحث
          </button>
          {activeSearchTerm && (
            <button
              onClick={handleClearSearch}
              className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />مسح
            </button>
          )}
        </div>

        {activeSearchTerm && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            <Search className="h-3 w-3" />
            نتائج البحث في "{searchColumnOptions.find(o => o.value === activeSearchColumn)?.label}" عن "{activeSearchTerm}" — {details.total_records} نتيجة
          </div>
        )}

        {/* Loading */}
        {isLoadingDetails && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Table */}
        {!isLoadingDetails && (
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-sm">
                <tr>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">ت</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">الاسم</th>
                  {details.all_columns.map((col) => (
                    <th key={col} className="px-3 py-2.5 font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {details.records.map((rec) => {
                  const isDuplicate = duplicateNamesSet.has(rec.normalized_name);
                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors ${isDuplicate ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-slate-50/80"}`}
                    >
                      <td className="px-3 py-2 text-center text-xs font-bold text-slate-400">
                        {rec.row_number ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isDuplicate && (
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-400 text-[8px] font-black text-white" title="اسم مكرر">
                              !
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{rec.normalized_name}</span>
                        </div>
                      </td>
                      {details.all_columns.map((col) => {
                        const val = rec.data_columns[col];
                        let display: string;
                        if (val === null || val === undefined) {
                          display = "";
                        } else if (typeof val === "number") {
                          display = val.toLocaleString("en-US");
                        } else {
                          display = String(val);
                        }
                        return (
                          <td key={col} className="px-3 py-2 text-slate-600 whitespace-nowrap">{display}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              disabled={detailsPage === 0}
              onClick={() => fetchDetails(selectedDataset, detailsPage - 1, activeSearchColumn, activeSearchTerm)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-600">{detailsPage + 1} / {totalPages}</span>
            <button
              disabled={detailsPage >= totalPages - 1}
              onClick={() => fetchDetails(selectedDataset, detailsPage + 1, activeSearchColumn, activeSearchTerm)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL SEARCH RESULTS VIEW
  // ═══════════════════════════════════════════════════════════════
  if (globalResults !== null) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleClearGlobalSearch}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              نتائج البحث العام عن "{globalSearchTerm}"
            </h3>
            <p className="text-xs text-slate-500">
              {globalResults.length} اسم تم العثور عليه — {globalResults.reduce((s, r) => s + r.occurrences.length, 0)} موقع
            </p>
          </div>
        </div>

        {globalResults.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <div className="text-center">
              <Search className="mx-auto mb-2 h-12 w-12 text-slate-300" />
              <p className="text-sm font-semibold">لا توجد نتائج لـ "{globalSearchTerm}"</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-4">
            {globalResults.map((result) => (
              <div key={result.normalized_name} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <span className="text-sm font-bold text-slate-800">{result.normalized_name}</span>
                  {result.occurrences.length > 1 && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                      <Copy className="h-3 w-3" />
                      موجود في {result.occurrences.length} مواقع!
                    </span>
                  )}
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50/50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">الوزارة</th>
                      <th className="px-3 py-2 font-semibold">الدائرة</th>
                      <th className="px-3 py-2 text-center font-semibold">السنة</th>
                      <th className="px-3 py-2 text-center font-semibold">ت</th>
                      <th className="px-3 py-2 font-semibold">الاسم الأصلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.occurrences.map((occ, i) => (
                      <tr key={i} className={`transition-colors hover:bg-indigo-50/40 ${result.occurrences.length > 1 ? "bg-rose-50/30" : ""}`}>
                        <td className="px-3 py-2 text-slate-700 font-semibold">{occ.ministry}</td>
                        <td className="px-3 py-2 text-slate-600">{occ.directorate}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-700">{occ.approval_year}</td>
                        <td className="px-3 py-2 text-center text-xs text-slate-400">{occ.row_number ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{occ.original_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY VIEW (Main)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Users className="h-5 w-5 text-indigo-600" />
          إدارة قاعدة بيانات الموظفين
        </h3>

        {/* Department search (filter summaries) */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث عن وزارة أو دائرة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Global name search */}
      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
          <Globe className="h-3.5 w-3.5" />
          بحث عن اسم موظف في جميع الدوائر
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-300" />
            <input
              type="text"
              placeholder="اكتب اسم الموظف..."
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
              className="h-10 w-full rounded-lg border border-indigo-200 bg-white py-2 pl-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            onClick={handleGlobalSearch}
            disabled={isGlobalSearching || !globalSearchTerm.trim()}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isGlobalSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            بحث عام
          </button>
        </div>
      </div>

      {!isDeleteUnlocked && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
          <p className="text-sm font-semibold">صلاحية الحذف غير مفعلة — يمكنك العرض فقط.</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="sticky top-0 bg-slate-50 text-slate-600 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold">الوزارة / الجهة</th>
              <th className="px-4 py-3 font-semibold">الدائرة / التشكيل</th>
              <th className="px-4 py-3 text-center font-semibold">سنة المصادقة</th>
              <th className="px-4 py-3 text-center font-semibold">عدد الموظفين</th>
              <th className="px-4 py-3 text-center font-semibold">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
                  <p className="mt-2 text-sm font-semibold">جاري جلب البيانات...</p>
                </td>
              </tr>
            ) : filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <Database className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                  <p className="text-sm font-semibold">
                    {searchQuery ? "لا توجد نتائج مطابقة." : "لا توجد بيانات موظفين محفوظة حتى الآن."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredSummaries.map((summary, idx) => {
                const id = `${summary.ministry}-${summary.directorate}-${summary.approval_year}`;
                const isDeleting = deletingId === id;
                return (
                  <tr
                    key={idx}
                    className="cursor-pointer transition-colors hover:bg-indigo-50/40"
                    onClick={() => handleOpenDetails(summary)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">{summary.ministry}</td>
                    <td className="px-4 py-3 text-slate-600">{summary.directorate}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">{summary.approval_year}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                        {summary.employee_count.toLocaleString()} موظف
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(summary)}
                        disabled={!isDeleteUnlocked || isDeleting}
                        className={`inline-flex items-center justify-center rounded-lg p-2 transition-all ${
                          !isDeleteUnlocked
                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white"
                        }`}
                        title={!isDeleteUnlocked ? "يتطلب تفعيل صلاحية الحذف" : "حذف بيانات الموظفين"}
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
