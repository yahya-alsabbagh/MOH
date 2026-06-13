import { useState, useEffect, useRef, useMemo } from "react";
import { Database, UploadCloud, BarChart3, Home, FileSpreadsheet, Building2, CalendarDays, Loader2, Landmark, CheckCircle2, Users, UsersRound, UserMinus, HardDrive, Search, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import AnalyticsDashboard from "./AnalyticsDashboard";
import DatabaseManager from "./DatabaseManager";
import EmployeeManager from "./EmployeeManager";
import SearchableCombobox from "../components/SearchableCombobox";
import ColumnAlignmentModal from "../components/ColumnAlignmentModal";

interface DepartmentMetric {
  id: number;
  ministry?: string;
  directorate?: string;
  approval_year?: number;
  job_title?: string;
  job_grade?: string;
  job_code?: string;
  male_count?: number;
  female_count?: number;
  vacant_count?: number;
  total_count?: number;
}

interface KpiSummary {
  total_male: number;
  total_female: number;
  total_vacant: number;
  total_count: number;
}

interface DeptInfo {
  dept_code: number;
  dept_name: string;
}

interface MinistryHierarchy {
  ministry_code: number;
  ministry_name: string;
  departments: DeptInfo[];
}

export default function DataCenter({ 
  isDeleteUnlocked = false,
  isUploadUnlocked = false,
  isAnalyticsUnlocked = false
}: { 
  isDeleteUnlocked?: boolean;
  isUploadUnlocked?: boolean;
  isAnalyticsUnlocked?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"upload" | "analytics" | "manage">("upload");
  const navigate = useNavigate();

  // Upload Form State
  const [filePath, setFilePath] = useState("");
  const [ministry, setMinistry] = useState("");
  const [directorate, setDirectorate] = useState("");
  const [year, setYear] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [insertedCount, setInsertedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // File type selector: "statistics" (old path) or "employees" (new path)
  const [fileType, setFileType] = useState<"statistics" | "employees">("statistics");

  // Employee-specific state
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState("");
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(false);

  // Column alignment modal state
  const [alignmentData, setAlignmentData] = useState<{ original: string; suggested: string | null; similarity: number; is_new: boolean }[] | null>(null);
  const [pendingColumnMapping, setPendingColumnMapping] = useState<Record<string, string>>({});

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Analytics State
  const [metrics, setMetrics] = useState<DepartmentMetric[]>([]);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Hierarchy State
  const [hierarchy, setHierarchy] = useState<MinistryHierarchy[]>([]);

  // Generate years from 2000 to 2090
  const years = Array.from({ length: 91 }, (_, i) => 2000 + i);

  useEffect(() => {
    invoke<MinistryHierarchy[]>("fetch_hierarchy_options")
      .then(setHierarchy)
      .catch(err => console.error("Failed to load hierarchy:", err));
  }, []);

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onDragDropEvent((event) => {
      let isInside = false;
      if (dropZoneRef.current && "position" in event.payload && (event.payload as any).position) {
        const payload = event.payload as any;
        const rect = dropZoneRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = payload.position.x / dpr;
        const y = payload.position.y / dpr;
        isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      }

      if (event.payload.type === "drop" && isInside) {
        const droppedPaths = event.payload.paths as string[];
        if (droppedPaths && droppedPaths.length > 0) {
          const path = droppedPaths[0];
          if (path.toLowerCase().endsWith(".xlsx") || path.toLowerCase().endsWith(".xls")) {
            setFilePath(path);
            setUploadSuccess(false);
            setErrorMsg("");
            setNameColumn("");
            setExcelHeaders([]);

            // If employee mode, auto-read headers on drop
            if (fileType === "employees") {
              invoke<string[]>("read_excel_headers", { filePath: path })
                .then(headers => setExcelHeaders(headers.map(h => h.trim().replace(/\n/g, ' ').replace(/  +/g, ' ')).filter(h => h !== "")))
                .catch(err => console.error("Failed to read headers:", err));
            }
          }
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [fileType]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalyticsData();
    }
  }, [activeTab]);

  const fetchAnalyticsData = async () => {
    setIsLoadingAnalytics(true);
    try {
      const fetchedMetrics = await invoke<DepartmentMetric[]>("fetch_all_metrics");
      const fetchedKpi = await invoke<KpiSummary>("fetch_kpi_summary");
      setMetrics(fetchedMetrics);
      setKpi(fetchedKpi);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
    });
    if (typeof selected === "string") {
      setFilePath(selected);
      setUploadSuccess(false);
      setErrorMsg("");
      setNameColumn("");
      setExcelHeaders([]);

      // If employee mode, auto-read headers
      if (fileType === "employees") {
        setIsLoadingHeaders(true);
        try {
          const headers = await invoke<string[]>("read_excel_headers", { filePath: selected });
          setExcelHeaders(headers.map(h => h.trim().replace(/\n/g, ' ').replace(/  +/g, ' ')).filter(h => h !== ""));
        } catch (err) {
          console.error("Failed to read headers:", err);
        } finally {
          setIsLoadingHeaders(false);
        }
      }
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setErrorMsg("");
    setUploadSuccess(false);
    try {
      if (fileType === "statistics") {
        // Old path — import to department_metrics
        const count = await invoke<number>("import_data_to_db", {
          filePath,
          ministry,
          directorate,
          year,
        });
        setInsertedCount(count);
        setUploadSuccess(true);
        setFilePath("");
      } else {
        // New path — check fuzzy column alignment first
        const headers = excelHeaders.filter(h => h !== nameColumn);
        const alignments = await invoke<{ original: string; suggested: string | null; similarity: number; is_new: boolean }[]>("align_employee_columns", {
          headers,
          nameColumn,
        });

        if (alignments.length > 0) {
          // Show alignment modal and wait for user
          setAlignmentData(alignments);
          setIsUploading(false);
          return;
        }

        // No alignment needed — import directly
        await doEmployeeImport({});
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(typeof err === "string" ? err : "حدث خطأ أثناء رفع البيانات.");
    } finally {
      setIsUploading(false);
    }
  };

  const doEmployeeImport = async (mapping: Record<string, string>) => {
    setIsUploading(true);
    setErrorMsg("");
    try {
      const count = await invoke<number>("import_employees_to_db", {
        filePath,
        ministry,
        directorate,
        year,
        nameColumn,
        columnMapping: Object.keys(mapping).length > 0 ? mapping : null,
      });
      setInsertedCount(count);
      setUploadSuccess(true);
      setFilePath("");
      setExcelHeaders([]);
      setNameColumn("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(typeof err === "string" ? err : "حدث خطأ أثناء رفع بيانات الموظفين.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAlignmentConfirm = (mapping: Record<string, string>) => {
    setAlignmentData(null);
    doEmployeeImport(mapping);
  };

  const handleAlignmentCancel = () => {
    setAlignmentData(null);
  };

  const isFormValid = fileType === "statistics"
    ? filePath && ministry && directorate && year
    : filePath && ministry && directorate && year && nameColumn;

  // Filtered metrics via useMemo for optimal performance
  const filteredMetrics = useMemo(() => {
    if (!searchQuery.trim()) return metrics;
    const query = searchQuery.toLowerCase();
    return metrics.filter(m => 
      (m.job_title && m.job_title.toLowerCase().includes(query)) ||
      (m.job_code && m.job_code.toLowerCase().includes(query))
    );
  }, [metrics, searchQuery]);

  // Dynamically calculate available tabs based on permissions
  const availableTabs = useMemo(() => {
    return [
      { id: "upload", label: "رفع ومزامنة البيانات", icon: UploadCloud, visible: isUploadUnlocked },
      { id: "analytics", label: "لوحة التحليلات الذكية", icon: BarChart3, visible: isAnalyticsUnlocked },
      { id: "manage", label: "إدارة قاعدة البيانات", icon: HardDrive, visible: isDeleteUnlocked },
      { id: "employees", label: "إدارة بيانات الموظفين", icon: UserCheck, visible: isUploadUnlocked },
    ].filter(t => t.visible);
  }, [isUploadUnlocked, isAnalyticsUnlocked, isDeleteUnlocked]);

  // Ensure active tab is valid
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id as any);
    }
  }, [availableTabs, activeTab]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 print:max-w-none print:overflow-visible print:h-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 shadow-inner">
            <Database className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">مركز إدارة البيانات والتحليلات</h2>
            <p className="text-sm text-slate-500">لوحة التحكم المركزية ومستودع الأعداد الكلية</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
        >
          <Home className="h-4 w-4 text-slate-500" />
          العودة للرئيسية
        </button>
      </div>

      {/* Segmented Tabs Control */}
      {availableTabs.length > 0 && (
        <div className="flex w-full rounded-xl bg-slate-200/50 p-1.5 shadow-inner backdrop-blur-sm sm:w-fit print:hidden">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:flex-none ${
                  activeTab === tab.id
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${activeTab === tab.id ? "text-indigo-600" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col print:overflow-visible print:h-auto print:border-none print:shadow-none">
        {activeTab === "upload" && isUploadUnlocked && (
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800">منصة رفع بيانات الموظفين</h3>
              <p className="text-sm text-slate-500">أدخل تفاصيل التشكيل وارفع ملف الإكسل ليتم تخزينه في قاعدة البيانات المركزية.</p>
            </div>

            {uploadSuccess && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-800">تم رفع ومزامنة البيانات بنجاح!</h4>
                  <p className="text-xs text-emerald-600">تم استخراج وإدراج عدد {insertedCount} سجل وظيفي إلى قاعدة البيانات.</p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-500">!</div>
                <div>
                  <h4 className="text-sm font-bold text-rose-800">فشل في المزامنة</h4>
                  <p className="text-xs text-rose-600">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Form Section */}
              <div className="flex flex-col gap-5 rounded-xl border border-slate-100 bg-slate-50/50 p-6">
                
                {/* Ministry */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Landmark className="h-4 w-4 text-slate-400" />
                    الوزارة أو الجهة غير المرتبطة بوزارة
                  </label>
                  <SearchableCombobox
                    options={hierarchy.map(h => ({ 
                      value: h.ministry_name, 
                      label: `${h.ministry_code.toString().padStart(2, '0')} - ${h.ministry_name}` 
                    }))}
                    value={ministry}
                    onChange={(val) => {
                      setMinistry(val);
                      setDirectorate(""); // Reset directorate when ministry changes
                    }}
                    placeholder="— اختر الوزارة —"
                    searchPlaceholder="ابحث عن وزارة..."
                  />
                </div>

                {/* Directorate */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    الدائرة أو التشكيل
                  </label>
                  <SearchableCombobox
                    options={(hierarchy.find(h => h.ministry_name === ministry)?.departments || []).map(d => {
                      const minCode = hierarchy.find(h => h.ministry_name === ministry)?.ministry_code || 0;
                      const adminCode = `${minCode.toString().padStart(2, '0')}${d.dept_code.toString().padStart(2, '0')}`;
                      return {
                        value: d.dept_name,
                        label: `${adminCode} - ${d.dept_name}`
                      };
                    })}
                    value={directorate}
                    onChange={setDirectorate}
                    placeholder="— اختر الدائرة —"
                    searchPlaceholder="ابحث عن دائرة..."
                    disabled={!ministry}
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    تاريخ المصادقة (السنة)
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">— اختر السنة —</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* File Type Selector */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Database className="h-4 w-4 text-slate-400" />
                    وجهة البيانات
                  </label>
                  <div className="flex w-full rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => { setFileType("statistics"); setNameColumn(""); setExcelHeaders([]); }}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all ${
                        fileType === "statistics"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      قاعدة الأعداد
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFileType("employees"); setNameColumn(""); setExcelHeaders([]); }}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-all ${
                        fileType === "employees"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      قاعدة الموظفين
                    </button>
                  </div>
                </div>

                {/* Name Column Selector (only for employees) */}
                {fileType === "employees" && excelHeaders.length > 0 && (
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                      اختر عمود الاسم
                    </label>
                    <select
                      value={nameColumn}
                      onChange={(e) => setNameColumn(e.target.value)}
                      className="w-full rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">— حدد عمود الاسم من الإكسل —</option>
                      {excelHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                )}

                {fileType === "employees" && filePath && isLoadingHeaders && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري قراءة عناوين الإكسل...
                  </div>
                )}
              </div>

              {/* File Upload Section */}
              <div className="flex flex-col gap-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  ملف الإكسل المعتمد
                </label>
                <div
                  ref={dropZoneRef}
                  onClick={handleSelectFile}
                  className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                    filePath
                      ? "border-emerald-400 bg-emerald-50/50"
                      : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30"
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                    filePath ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                  }`}>
                    {filePath ? <FileSpreadsheet className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${filePath ? "text-emerald-700" : "text-slate-700"}`}>
                      {filePath ? "تم اختيار الملف بنجاح" : "اسحب وافلت ملف الإكسل هنا، أو اضغط للاختيار"}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-400" dir="ltr">
                      {filePath || "يدعم فقط صيغ .xlsx و .xls"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <button
                    onClick={handleUpload}
                    disabled={!isFormValid || isUploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-indigo-600 to-indigo-800 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-indigo-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جاري تهيئة ورفع البيانات...
                      </>
                    ) : (
                      <>
                        <Database className="h-5 w-5" />
                        {fileType === "statistics" ? "بدء رفع ومزامنة البيانات للتشكيل" : "رفع بيانات الموظفين"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Column Alignment Modal */}
            {alignmentData && (
              <ColumnAlignmentModal
                alignments={alignmentData}
                onConfirm={handleAlignmentConfirm}
                onCancel={handleAlignmentCancel}
              />
            )}
          </div>
        )}

        {activeTab === "analytics" && isAnalyticsUnlocked && (
          <div className="flex flex-1 flex-col bg-slate-50/30">
            <AnalyticsDashboard />
          </div>
        )}
        {activeTab === "manage" && isDeleteUnlocked && (
          <div className="flex flex-1 flex-col bg-slate-50/30">
            <DatabaseManager isDeleteUnlocked={isDeleteUnlocked} />
          </div>
        )}
        {activeTab === "employees" && isUploadUnlocked && (
          <div className="flex flex-1 flex-col bg-slate-50/30">
            <EmployeeManager isDeleteUnlocked={isDeleteUnlocked} />
          </div>
        )}
      </div>
    </div>
  );
}
