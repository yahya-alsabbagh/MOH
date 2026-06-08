import { useState, useEffect, useRef, useMemo } from "react";
import { Database, UploadCloud, BarChart3, Home, FileSpreadsheet, Building2, CalendarDays, Loader2, Landmark, CheckCircle2, Users, UsersRound, UserMinus, HardDrive, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import AnalyticsDashboard from "./AnalyticsDashboard";
import DatabaseManager from "./DatabaseManager";

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

export default function DataCenter({ isDeleteUnlocked = false }: { isDeleteUnlocked?: boolean }) {
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

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Analytics State
  const [metrics, setMetrics] = useState<DepartmentMetric[]>([]);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Generate years from 2000 to 2090
  const years = Array.from({ length: 91 }, (_, i) => 2000 + i);

  // Placeholder Ministries
  const ministries = [
    "وزارة الصحة",
    "وزارة التربية",
    "وزارة التعليم العالي",
    "وزارة الداخلية",
    "وزارة الدفاع",
  ];

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
          }
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

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
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setErrorMsg("");
    setUploadSuccess(false);
    try {
      const count = await invoke<number>("import_data_to_db", {
        filePath,
        ministry,
        directorate,
        year,
      });
      setInsertedCount(count);
      setUploadSuccess(true);
      setFilePath("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(typeof err === "string" ? err : "حدث خطأ أثناء رفع البيانات.");
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = filePath && ministry && directorate && year;

  // Filtered metrics via useMemo for optimal performance
  const filteredMetrics = useMemo(() => {
    if (!searchQuery.trim()) return metrics;
    const query = searchQuery.toLowerCase();
    return metrics.filter(m => 
      (m.job_title && m.job_title.toLowerCase().includes(query)) ||
      (m.job_code && m.job_code.toLowerCase().includes(query))
    );
  }, [metrics, searchQuery]);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
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
      <div className="flex w-full rounded-xl bg-slate-200/50 p-1.5 shadow-inner backdrop-blur-sm sm:w-fit">
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:flex-none ${
            activeTab === "upload"
              ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UploadCloud className={`h-4 w-4 ${activeTab === "upload" ? "text-indigo-600" : ""}`} />
          رفع ومزامنة البيانات
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:flex-none ${
            activeTab === "analytics"
              ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className={`h-4 w-4 ${activeTab === "analytics" ? "text-indigo-600" : ""}`} />
          لوحة التحليلات الذكية
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:flex-none ${
            activeTab === "manage"
              ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <HardDrive className={`h-4 w-4 ${activeTab === "manage" ? "text-indigo-600" : ""}`} />
          إدارة قاعدة البيانات
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {activeTab === "upload" && (
          <div className="flex h-full flex-col p-6 sm:p-8 overflow-y-auto">
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
                  <select
                    value={ministry}
                    onChange={(e) => setMinistry(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">— اختر الوزارة —</option>
                    {ministries.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Directorate */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    الدائرة أو التشكيل
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: دائرة صحة الرصافة"
                    value={directorate}
                    onChange={(e) => setDirectorate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                        بدء رفع ومزامنة البيانات للتشكيل
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="flex h-full flex-col bg-slate-50/30 overflow-hidden">
            <AnalyticsDashboard />
          </div>
        )}
        {activeTab === "manage" && (
          <div className="flex h-full flex-col bg-slate-50/30 overflow-hidden">
            <DatabaseManager isDeleteUnlocked={isDeleteUnlocked} />
          </div>
        )}
      </div>
    </div>
  );
}
