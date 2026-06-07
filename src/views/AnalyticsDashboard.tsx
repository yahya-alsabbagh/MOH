import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Search, Building2, Landmark, Users, UsersRound, UserMinus, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
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
  total_vacant: number;
  total_count: number;
}

interface BarChartData {
  directorate: string;
  total_vacant: number;
  total_count: number;
}

interface PieChartData {
  total_male: number;
  total_female: number;
}

interface AnalyticsResponse {
  kpis: KpiSummary;
  bar_chart_data: BarChartData[];
  pie_chart_data: PieChartData;
  grid_data: DepartmentMetric[];
  total_records: number;
}

interface FilterOptions {
  ministries: string[];
  directorates: string[];
}

const COLORS = ['#4f46e5', '#ec4899']; // Indigo for Male, Pink for Female

export default function AnalyticsDashboard() {
  const [ministries, setMinistries] = useState<string[]>([]);
  const [directorates, setDirectorates] = useState<string[]>([]);
  
  const [selectedMinistry, setSelectedMinistry] = useState<string>("");
  const [selectedDirectorate, setSelectedDirectorate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'ذكور', value: data.pie_chart_data.total_male },
      { name: 'إناث', value: data.pie_chart_data.total_female }
    ];
  }, [data]);

  const totalPages = data ? Math.ceil(data.total_records / pageSize) : 0;

  return (
    <div className="flex h-full flex-col p-6 gap-6 overflow-hidden">
      {/* 1. Command Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shrink-0">
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

      {isLoading && !data ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : data ? (
        <>
          {/* 2. KPIs & Charts */}
          <div className="flex flex-col gap-6 shrink-0 overflow-y-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600"><Users className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">إجمالي الملاك</p>
                    <h4 className="text-2xl font-black text-slate-800">{data.kpis.total_count.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-600"><UserMinus className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">الشواغر</p>
                    <h4 className="text-2xl font-black text-slate-800">{data.kpis.total_vacant.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600"><UsersRound className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">الذكور</p>
                    <h4 className="text-2xl font-black text-slate-800">{data.kpis.total_male.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-pink-100 p-2 text-pink-600"><UsersRound className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">الإناث</p>
                    <h4 className="text-2xl font-black text-slate-800">{data.kpis.total_female.toLocaleString()}</h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[300px]">
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
                <h4 className="text-sm font-bold text-slate-700 mb-4">الملاك والشواغر حسب التشكيل</h4>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.bar_chart_data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="directorate" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{fontSize: 12}} />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                      <Legend wrapperStyle={{fontSize: 12}} />
                      <Bar dataKey="total_count" name="الملاك" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_vacant" name="الشواغر" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
                <h4 className="text-sm font-bold text-slate-700 mb-4">نسبة النوع</h4>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: 12}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Data Grid Layer */}
          <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mt-2 min-h-[300px]">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-right text-sm text-slate-600 relative">
                <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase text-slate-700 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200">الوزارة / الدائرة</th>
                    <th className="px-4 py-3 border-b border-slate-200">العنوان الوظيفي</th>
                    <th className="px-4 py-3 border-b border-slate-200">الدرجة</th>
                    <th className="px-4 py-3 border-b border-slate-200">الرمز</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">الذكور</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">الإناث</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">الشواغر</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.grid_data.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-800">
                        {m.ministry || "-"} 
                        <span className="block text-[10px] font-normal text-slate-400">{m.directorate || "-"}</span>
                      </td>
                      <td className="px-4 py-2 font-bold text-indigo-700 text-xs">{m.job_title || "-"}</td>
                      <td className="px-4 py-2"><span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">{m.job_grade || "-"}</span></td>
                      <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{m.job_code || "-"}</td>
                      <td className="px-4 py-2 text-center font-semibold text-xs">{m.male_count ?? "-"}</td>
                      <td className="px-4 py-2 text-center font-semibold text-xs">{m.female_count ?? "-"}</td>
                      <td className="px-4 py-2 text-center font-semibold text-amber-600 text-xs">{m.vacant_count ?? "-"}</td>
                      <td className="px-4 py-2 text-center font-bold text-emerald-600 text-xs">{m.total_count ?? "-"}</td>
                    </tr>
                  ))}
                  {data.grid_data.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        لا توجد نتائج تطابق بحثك.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 shrink-0">
              <span className="text-xs text-slate-500">
                إجمالي السجلات: <span className="font-bold text-slate-700">{data.total_records.toLocaleString()}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-slate-600">
                  {page + 1} / {totalPages || 1}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
