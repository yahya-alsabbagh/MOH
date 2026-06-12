import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Search, Building2, Landmark, Users, UsersRound, UserMinus, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList
} from "recharts";

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
  total_count: number;
  total_vacant: number;
}

interface GradeDistributionData {
  job_grade: string;
  count: number;
  vacant_count: number;
}

interface GenderParityData {
  job_title: string;
  males: number;
  females: number;
  vacancies: number;
  total: number;
}

interface PieChartData {
  total_male: number;
  total_female: number;
  total_vacant: number;
}

interface AnalyticsResponse {
  kpis: KpiSummary;
  pie_chart_data: PieChartData;
  grade_distribution: GradeDistributionData[];
  gender_parity: GenderParityData[];
  grid_data: DepartmentMetric[];
  total_records: number;
}

interface FilterOptions {
  ministries: string[];
  directorates: string[];
}

const COLORS = ['#3b82f6', '#ec4899']; // Indigo for Male, Pink for Female



export default function AnalyticsDashboard() {
  const [ministries, setMinistries] = useState<string[]>([]);
  const [directorates, setDirectorates] = useState<string[]>([]);
  
  const [selectedMinistry, setSelectedMinistry] = useState<string>("");
  const [selectedDirectorate, setSelectedDirectorate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const [page, setPage] = useState(0);
  const [pageSize] = useState(9999999);
  
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [allGridData, setAllGridData] = useState<DepartmentMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [showCharts, setShowCharts] = useState(true);

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const options = await invoke<FilterOptions>("fetch_filter_options", {
          ministry: selectedMinistry || null,
        });
        if (!selectedMinistry) {
          setMinistries(options.ministries);
        }
        setDirectorates(options.directorates);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFilters();
  }, [selectedMinistry]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await invoke<AnalyticsResponse>("fetch_filtered_analytics", {
          ministry: selectedMinistry || null,
          directorate: selectedDirectorate || null,
          search: searchQuery || null,
          page,
          pageSize,
        });
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce for search query
    const timeout = setTimeout(fetchData, 300);
    return () => clearTimeout(timeout);
  }, [selectedMinistry, selectedDirectorate, searchQuery, page, pageSize]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [selectedMinistry, selectedDirectorate, searchQuery]);

  const handlePrint = async () => {
    // Fetch ALL data for printing (no pagination)
    try {
      const allData = await invoke<AnalyticsResponse>("fetch_filtered_analytics", {
        ministry: selectedMinistry || null,
        directorate: selectedDirectorate || null,
        search: searchQuery || null,
        page: 0,
        pageSize: 9999999,
      });
      setAllGridData(allData.grid_data);
      setIsPrintMode(true);
      // Wait for charts to fully re-render SVG labels, then print
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  const pieData = useMemo(() => {
    if (!data) return [];
    const base = [
      { name: 'ذكور', value: data.pie_chart_data?.total_male || 0 },
      { name: 'إناث', value: data.pie_chart_data?.total_female || 0 }
    ];
    if (data.pie_chart_data?.total_vacant > 0) {
      base.push({ name: 'شواغر', value: data.pie_chart_data.total_vacant });
    }
    return base;
  }, [data]);

  const COLORS = ['#3b82f6', '#ec4899', '#f59e0b']; // Indigo for Male, Pink for Female, Orange for Vacancies

  // Dynamic chart heights based on data count
  const gradeChartHeight = useMemo(() => {
    if (!data) return 300;
    const grades = data.grade_distribution.length;
    const hasVacancies = data.kpis.total_vacant > 0;
    const perGrade = hasVacancies ? 50 : 30;
    return Math.max(300, grades * perGrade + 20);
  }, [data]);

  const gradeChartPrintHeight = useMemo(() => {
    if (!data) return 150;
    const grades = data.grade_distribution.length;
    const hasVacancies = data.kpis.total_vacant > 0;
    const perGrade = hasVacancies ? 25 : 18;
    return Math.max(120, Math.min(280, grades * perGrade + 15));
  }, [data]);

  const parityChartHeight = useMemo(() => {
    if (!data) return 300;
    const jobs = data.gender_parity.length;
    return Math.max(300, jobs * 30 + 45);
  }, [data]);

  const parityChartPrintHeight = useMemo(() => {
    if (!data) return 150;
    const jobs = data.gender_parity.length;
    return Math.max(120, Math.min(280, jobs * 18 + 25));
  }, [data]);

  const totalPages = data ? Math.ceil(data.total_records / pageSize) : 0;

  return (
    <div className="flex flex-col p-6 gap-6 print:p-0 print:bg-white print:gap-4 print:overflow-visible print:h-auto" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      {/* Print-only Header */}
      <div className="hidden print:flex flex-col border-b-2 border-slate-800 pb-2 px-4">
        <div className="flex justify-between font-bold text-lg">
          <span>الوزارة: {selectedMinistry || 'كل الوزارات'}</span>
          <span>الدائرة: {selectedDirectorate || 'كل الدوائر'}</span>
        </div>
      </div>

      {/* 1. Command Hub & Print Button */}
      <div className="flex flex-col md:flex-row gap-4 shrink-0 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex-1">
          <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Landmark className="h-4 w-4 text-slate-400" /> الوزارة
          </label>
          <select
            value={selectedMinistry}
            onChange={(e) => setSelectedMinistry(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">الكل</option>
            {ministries.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Building2 className="h-4 w-4 text-slate-400" /> الدائرة
          </label>
          <select
            value={selectedDirectorate}
            onChange={(e) => setSelectedDirectorate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">الكل</option>
            {directorates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Search className="h-4 w-4 text-slate-400" /> بحث (العنوان الوظيفي)
          </label>
          <input
            type="text"
            placeholder="اكتب للبحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex gap-3 items-stretch print:hidden">
        <button
          onClick={handlePrint}
          className="rounded-xl bg-indigo-600 px-6 py-4 font-bold text-white shadow-sm hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          طباعة التقرير
        </button>
      </div>
    </div>

      {isLoading && !data ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : data ? (
        <>
          {/* 2. KPIs & Charts */}
          <div className="flex flex-col gap-6 shrink-0 print:overflow-visible print:h-auto print:gap-4 print:my-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm print:p-2">
                <div className="flex items-center gap-3 print:gap-2">
                  <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600 print:p-1"><Users className="h-5 w-5 print:h-4 print:w-4" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase print:text-[10px]">إجمالي الملاك</p>
                    <h4 className="text-2xl font-black text-slate-800 print:text-lg">{data.kpis.total_count.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm print:p-2">
                <div className="flex items-center gap-3 print:gap-2">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 print:p-1"><UsersRound className="h-5 w-5 print:h-4 print:w-4" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase print:text-[10px]">الذكور</p>
                    <h4 className="text-2xl font-black text-slate-800 print:text-lg">{data.kpis.total_male.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm print:p-2">
                <div className="flex items-center gap-3 print:gap-2">
                  <div className="rounded-lg bg-pink-100 p-2 text-pink-600 print:p-1"><UsersRound className="h-5 w-5 print:h-4 print:w-4" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase print:text-[10px]">الإناث</p>
                    <h4 className="text-2xl font-black text-slate-800 print:text-lg">{data.kpis.total_female.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm print:p-2">
                <div className="flex items-center gap-3 print:gap-2">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-600 print:p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 print:h-4 print:w-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase print:text-[10px]">الشواغر</p>
                    <h4 className="text-2xl font-black text-slate-800 print:text-lg">{data.kpis.total_vacant.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Toggle Charts Visibility Button */}
            <div className="flex justify-end print:hidden mb-2 relative z-10">
              <button
                onClick={() => setShowCharts(prev => !prev)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors border ${
                  showCharts
                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    : 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                {showCharts ? 'إخفاء الرسوم البيانية' : 'إظهار الرسوم البيانية'}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showCharts ? (
                    <><path d="m18 15-6-6-6 6"/></>
                  ) : (
                    <><path d="m6 9 6 6 6-6"/></>
                  )}
                </svg>
              </button>
            </div>

            {/* Charts Row 1: Grade Pyramid & Gender Parity */}
            {showCharts && <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px] print:min-h-0 print:gap-4 print:page-break-inside-avoid print:break-inside-avoid ${isPrintMode && searchQuery ? 'print:grid-cols-1' : 'print:grid-cols-2'}`}>
              {/* Grade Pyramid */}
              <div className={`rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col print:p-2 print:break-inside-avoid ${isPrintMode ? '' : 'overflow-hidden'}`}>
                <h4 className="text-sm font-bold text-slate-700 mb-4 print:mb-1">الدرجات الوظيفية</h4>
                <div className={`flex relative ${isPrintMode ? '' : 'overflow-hidden'}`} dir="ltr" style={{ height: `${isPrintMode ? gradeChartPrintHeight : gradeChartHeight}px` }}>
                  <div className="absolute inset-y-0 right-0 left-0 flex flex-col pointer-events-none z-0" style={{ padding: '5px 0' }}>
                    {data.grade_distribution.map((_, i) => (
                      <div key={i} className={`flex-1 ${i !== data.grade_distribution.length - 1 ? 'border-b border-slate-300 print:border-slate-400' : ''}`} />
                    ))}
                  </div>
                  <div className="flex-1 relative z-10 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.grade_distribution}
                        layout="vertical"
                        margin={{ top: 5, right: isPrintMode ? 5 : 45, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid horizontal={false} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="job_grade" hide />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Bar isAnimationActive={!isPrintMode} dataKey="count" name="العدد" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={isPrintMode ? 10 : 18}>
                          <LabelList dataKey="count" position={isPrintMode ? 'insideRight' : 'right'} fill="#000" fontSize={isPrintMode ? 9 : 11} fontWeight="bold" formatter={(val: any) => Number(val) > 0 ? Number(val).toLocaleString() : ''} />
                        </Bar>
                        {data.kpis.total_vacant > 0 && (
                          <Bar isAnimationActive={!isPrintMode} dataKey="vacant_count" name="شواغر" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={isPrintMode ? 10 : 18}>
                            <LabelList dataKey="vacant_count" position={isPrintMode ? 'insideRight' : 'right'} fill="#000" fontSize={isPrintMode ? 9 : 11} fontWeight="bold" formatter={(val: any) => Number(val) > 0 ? Number(val).toLocaleString() : ''} />
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-around border-l-2 border-slate-300 pr-0 pl-3 shrink-0 relative z-10" style={{width: '80px'}}>
                    {data.grade_distribution.map((item, i) => (
                      <span key={i} className="text-xs font-bold text-slate-800 text-right leading-none" dir="rtl">{item.job_grade}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Gender Parity */}
              <div className={`rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col print:p-2 print:break-inside-avoid ${isPrintMode ? '' : 'overflow-hidden'}`}>
                <div className="flex items-center justify-between mb-4 print:mb-1">
                  <h4 className="text-sm font-bold text-slate-700">العناوين الوظيفية</h4>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600" dir="rtl">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-sm shrink-0"></span> ذكور</div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-pink-500 rounded-sm shrink-0"></span> إناث</div>
                    {data.kpis.total_vacant > 0 && <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-sm shrink-0"></span> شواغر</div>}
                  </div>
                </div>
                <div className={`flex ${isPrintMode ? '' : 'overflow-hidden'}`} dir="ltr" style={{ height: `${isPrintMode ? parityChartPrintHeight : parityChartHeight}px` }}>
                  <div className="flex-1 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.gender_parity}
                        layout="vertical"
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="job_title" hide />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Bar isAnimationActive={!isPrintMode} dataKey="males" name="ذكور" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} maxBarSize={isPrintMode ? 10 : 18}>
                          <LabelList dataKey="males" position="inside" fill="#000" fontSize={9} fontWeight="bold" formatter={(val: any) => Number(val) > 0 ? Number(val).toLocaleString() : ''} />
                        </Bar>
                        <Bar isAnimationActive={!isPrintMode} dataKey="females" name="إناث" stackId="a" fill="#ec4899" radius={data.kpis.total_vacant > 0 ? [0, 0, 0, 0] : [0, 4, 4, 0]} maxBarSize={isPrintMode ? 10 : 18}>
                          <LabelList dataKey="females" position="inside" fill="#000" fontSize={9} fontWeight="bold" formatter={(val: any) => Number(val) > 0 ? Number(val).toLocaleString() : ''} />
                        </Bar>
                        {data.kpis.total_vacant > 0 && (
                          <Bar isAnimationActive={!isPrintMode} dataKey="vacancies" name="شواغر" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={isPrintMode ? 10 : 18}>
                            <LabelList dataKey="vacancies" position="inside" fill="#000" fontSize={9} fontWeight="bold" formatter={(val: any) => Number(val) > 0 ? Number(val).toLocaleString() : ''} />
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-around border-l-2 border-slate-300 pr-0 pl-3 shrink-0 pt-14 pb-1" style={{width: '120px'}}>
                    {data.gender_parity.map((item, i) => (
                      <span key={i} className="text-[10px] font-bold text-slate-800 text-right leading-none" dir="rtl">{item.job_title}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>}

            {/* Charts Row 2: PieChart */}
            {showCharts && <div className="flex min-h-[300px] print:min-h-0">
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col print:p-2 print:break-inside-avoid">
                <h4 className="text-sm font-bold text-slate-700 mb-4 text-center print:mb-1">نسبة النوع</h4>
                <div className="flex-1 flex items-center justify-center gap-8 flex-wrap print:gap-4">
                  {/* Donut Chart */}
                  <div style={{width: isPrintMode ? 140 : 200, height: isPrintMode ? 140 : 200}} dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          isAnimationActive={!isPrintMode}
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={isPrintMode ? 30 : 55}
                          outerRadius={isPrintMode ? 50 : 80}
                          paddingAngle={5}
                          dataKey="value"
                          label={(props: any) => {
                            const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) / 2;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text x={x} y={y} fill="#000" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                                {`${((percent || 0) * 100).toFixed(1)}%`}
                              </text>
                            );
                          }}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Stats Cards */}
                  <div className="flex flex-col gap-4">
                    {pieData.map((entry, i) => {
                      const total = pieData.reduce((s, e) => s + e.value, 0);
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3 border" style={{borderColor: COLORS[i], backgroundColor: `${COLORS[i]}10`}}>
                          <div className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor: COLORS[i]}}></div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{entry.name}</span>
                            <span className="text-lg font-extrabold" style={{color: COLORS[i]}}>{Number(entry.value).toLocaleString()}</span>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>}
          </div>

          {/* 3. Data Grid Layer */}
          <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mt-2 min-h-[300px] print:overflow-visible print:h-auto print:block print:break-before-page" style={{ pageBreakBefore: isPrintMode ? 'always' : 'auto' }}>
            <div className="flex-1 overflow-auto print:overflow-visible print:h-auto">
              <table className="w-full text-right text-sm text-slate-600 relative">
                <thead className="sticky top-0 bg-slate-50 text-sm font-bold uppercase text-slate-700 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">الوزارة / الدائرة</th>
                    <th className="px-4 py-3 border-b border-slate-200">العنوان الوظيفي</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-base">الدرجة</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-base">الرمز</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center text-base">الذكور</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center text-base">الإناث</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center text-amber-600 text-base">الشواغر</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center text-base">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const displayData = isPrintMode && allGridData.length > 0 ? allGridData : data.grid_data;
                    if (!displayData || displayData.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            لا توجد نتائج تطابق بحثك.
                          </td>
                        </tr>
                      );
                    }

                    const groups: { grade: string; records: DepartmentMetric[] }[] = [];
                    displayData.forEach(rec => {
                      const g = rec.job_grade || "-";
                      let group = groups.find(x => x.grade === g);
                      if (!group) {
                        group = { grade: g, records: [] };
                        groups.push(group);
                      }
                      group.records.push(rec);
                    });

                    return (
                      <>
                        {groups.map((group, gIdx) => {
                          const dist = data.grade_distribution.find(d => d.job_grade === group.grade);
                          const totalGradeCount = dist ? dist.count : group.records.reduce((sum, r) => sum + ((r.male_count as number) || 0) + ((r.female_count as number) || 0), 0);
                          
                          return (
                            <React.Fragment key={`group-${gIdx}`}>
                              {group.records.map((m) => (
                                <tr key={m.id} className="transition-colors hover:bg-slate-50">
                                  <td className="px-4 py-2 font-semibold text-slate-800">
                                    {m.ministry || "-"} 
                                    <span className="block text-[10px] font-normal text-slate-400">{m.directorate || "-"}</span>
                                  </td>
                                  <td className="px-4 py-2 font-bold text-indigo-700 text-xs">{m.job_title || "-"}</td>
                                  <td className="px-4 py-2"><span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">{m.job_grade || "-"}</span></td>
                                  <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{m.job_code || "-"}</td>
                                  <td className="px-4 py-2 text-center font-bold text-base">{m.male_count ?? "-"}</td>
                                  <td className="px-4 py-2 text-center font-bold text-base">{m.female_count ?? "-"}</td>
                                  <td className="px-4 py-2 text-center font-black text-amber-600 text-base">{m.vacant_count ?? "-"}</td>
                                  <td className="px-4 py-2 text-center font-black text-emerald-600 text-base">{(m.male_count ?? 0) + (m.female_count ?? 0)}</td>
                                </tr>
                              ))}
                              {/* Subtotal Row for this Grade */}
                              <tr className="bg-amber-50/50">
                                <td colSpan={7} className="px-4 py-3 font-bold text-slate-800 text-left border-y border-amber-100 text-base">
                                  مجموع الدرجة ({group.grade}):
                                </td>
                                <td className="px-4 py-3 text-center font-black text-amber-600 border-y border-amber-100 text-lg">
                                  {totalGradeCount.toLocaleString()}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        {/* Grand Total Row */}
                        <tr className="bg-slate-100">
                          <td colSpan={7} className="px-4 py-4 font-black text-slate-800 text-left border-y border-slate-300 text-lg">
                            المجموع الكلي:
                          </td>
                          <td className="px-4 py-4 text-center font-black text-indigo-700 border-y border-slate-300 text-2xl">
                            {data.kpis.total_count.toLocaleString()}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Footer / Total Count Only (No Pagination) */}
            <div className="flex items-center justify-start border-t border-slate-200 bg-slate-50 px-4 py-3 shrink-0 print:hidden">
              <span className="text-sm text-slate-500">
                إجمالي السجلات المعروضة: <span className="font-bold text-slate-700">{data.total_records.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </>
      ) : null}

      {/* Print-only Copyright Footer - at the very bottom */}
      <div className="hidden print:block text-center mt-12 pt-4 border-t border-slate-300">
        <p className="text-xs font-medium text-slate-600">© Yahya Hafedh ALsabbagh 2026</p>
      </div>
    </div>
  );
}
