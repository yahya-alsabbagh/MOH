import { useState, useEffect, useRef, useMemo } from "react";
import { Database, UploadCloud, BarChart3, Home, FileSpreadsheet, Building2, CalendarDays, Loader2, Landmark, CheckCircle2, Users, UsersRound, UserMinus, HardDrive, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

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

export default function DataCenter() {
  const [activeTab, setActiveTab] = useState<"upload" | "analytics">("upload");
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
          <div className="flex h-full flex-col bg-slate-50/30">
            {isLoadingAnalytics ? (
              <div className="flex flex-1 items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="font-bold">جاري تحميل التحليلات...</span>
              </div>
            ) : metrics.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center opacity-80 p-12">
                <div className="rounded-full bg-slate-100 p-6 shadow-sm border border-slate-200">
                  <HardDrive className="h-16 w-16 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700">لا توجد بيانات حالياً</h3>
                <p className="max-w-md text-sm text-slate-500">
                  قاعدة البيانات فارغة. يرجى التوجه إلى قسم (رفع ومزامنة البيانات) ورفع ملف الإكسل لتوليد التحليلات.
                </p>
                <button
                  onClick={() => setActiveTab("upload")}
                  className="mt-4 rounded-lg bg-indigo-50 px-6 py-2 font-bold text-indigo-600 hover:bg-indigo-100"
                >
                  الذهاب للرفع
                </button>
              </div>
            ) : (
              <div className="flex h-full flex-col p-6 gap-6">
                
                {/* KPI Cards */}
                {kpi && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Users className="h-5 w-5" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">إجمالي الملاك</p>
                          <h4 className="text-2xl font-black text-slate-800">{kpi.total_count.toLocaleString()}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><UserMinus className="h-5 w-5" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">إجمالي الشواغر</p>
                          <h4 className="text-2xl font-black text-slate-800">{kpi.total_vacant.toLocaleString()}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><UsersRound className="h-5 w-5" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">إجمالي الذكور</p>
                          <h4 className="text-2xl font-black text-slate-800">{kpi.total_male.toLocaleString()}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-pink-50 p-2 text-pink-600"><UsersRound className="h-5 w-5" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">إجمالي الإناث</p>
                          <h4 className="text-2xl font-black text-slate-800">{kpi.total_female.toLocaleString()}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث بالعنوان أو الرمز الوظيفي..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border-none bg-slate-50 pr-10 pl-4 py-2 text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                    عرض {filteredMetrics.length} سجل
                  </div>
                </div>

                {/* Data Grid */}
                <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-right text-sm text-slate-600">
                    <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase text-slate-700 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-4 border-b border-slate-200">الوزارة / الدائرة</th>
                        <th className="px-4 py-4 border-b border-slate-200">العنوان الوظيفي</th>
                        <th className="px-4 py-4 border-b border-slate-200">الدرجة</th>
                        <th className="px-4 py-4 border-b border-slate-200">الرمز</th>
                        <th className="px-4 py-4 border-b border-slate-200 text-center">الذكور</th>
                        <th className="px-4 py-4 border-b border-slate-200 text-center">الإناث</th>
                        <th className="px-4 py-4 border-b border-slate-200 text-center">الشواغر</th>
                        <th className="px-4 py-4 border-b border-slate-200 text-center">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMetrics.map((m) => (
                        <tr key={m.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {m.ministry || "-"} 
                            <span className="block text-xs font-normal text-slate-400">{m.directorate || "-"} ({m.approval_year || "-"})</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-700">{m.job_title || "-"}</td>
                          <td className="px-4 py-3"><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 border border-slate-200">{m.job_grade || "-"}</span></td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.job_code || "-"}</td>
                          <td className="px-4 py-3 text-center font-semibold">{m.male_count ?? "-"}</td>
                          <td className="px-4 py-3 text-center font-semibold">{m.female_count ?? "-"}</td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-600">{m.vacant_count ?? "-"}</td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-600">{m.total_count ?? "-"}</td>
                        </tr>
                      ))}
                      {filteredMetrics.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                            لا توجد نتائج تطابق بحثك.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
