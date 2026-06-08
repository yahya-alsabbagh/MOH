import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Trash2, ShieldAlert, Loader2, Database, AlertTriangle, Search } from "lucide-react";

interface DatabaseSummary {
  ministry: string | null;
  directorate: string | null;
  approval_year: number | null;
  records_count: number;
  total_employees: number;
}

export default function DatabaseManager({ isDeleteUnlocked = false }: { isDeleteUnlocked?: boolean }) {
  const [summaries, setSummaries] = useState<DatabaseSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchSummary = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = await invoke<DatabaseSummary[]>("fetch_database_summary");
      setSummaries(data);
    } catch (err: any) {
      console.error("Failed to fetch database summary:", err);
      setErrorMsg(typeof err === "string" ? err : "فشل في جلب السجلات");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleDelete = async (summary: DatabaseSummary) => {
    if (!isDeleteUnlocked) return;
    
    const confirmMsg = `هل أنت متأكد تماماً من رغبتك في حذف جميع السجلات الخاصة بـ (${summary.directorate || "بدون تشكيل"}) التابعة لـ (${summary.ministry || "بدون وزارة"}) لسنة ${summary.approval_year}؟\n\nهذا الإجراء سيقوم بمسح ${summary.records_count} قيد ولا يمكن التراجع عنه!`;
    
    const isConfirmed = await confirm(confirmMsg, { title: "تأكيد الحذف", kind: "warning" });
    if (!isConfirmed) {
      return;
    }

    const id = `${summary.ministry}-${summary.directorate}-${summary.approval_year}`;
    setDeletingId(id);
    setErrorMsg("");

    try {
      await invoke("delete_dataset", {
        ministry: summary.ministry || "",
        directorate: summary.directorate || "",
        approvalYear: summary.approval_year || 0,
      });
      // Re-fetch after successful deletion
      await fetchSummary();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(typeof err === "string" ? err : "تعذر حذف السجلات");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return summaries;
    const query = searchQuery.toLowerCase();
    return summaries.filter(s => 
      (s.ministry && s.ministry.toLowerCase().includes(query)) ||
      (s.directorate && s.directorate.toLowerCase().includes(query))
    );
  }, [summaries, searchQuery]);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            إدارة سجلات قاعدة البيانات
          </h3>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث عن تشكيل أو وزارة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {!isDeleteUnlocked && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
          <p className="text-sm font-semibold">
            لا يمكنك حذف البيانات!
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
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
              <th className="px-4 py-3 font-semibold text-center">سنة المصادقة</th>
              <th className="px-4 py-3 font-semibold text-center">عدد القيود (الصفوف)</th>
              <th className="px-4 py-3 font-semibold text-center">إجمالي الملاكات</th>
              <th className="px-4 py-3 font-semibold text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
                  <p className="mt-2 text-sm font-semibold">جاري جلب البيانات...</p>
                </td>
              </tr>
            ) : filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Database className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">
                    {searchQuery ? "لا توجد نتائج مطابقة لبحثك." : "لا توجد أي سجلات محفوظة في قاعدة البيانات حتى الآن."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredSummaries.map((summary, idx) => {
                const id = `${summary.ministry}-${summary.directorate}-${summary.approval_year}`;
                const isDeleting = deletingId === id;
                return (
                  <tr key={idx} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-800">{summary.ministry || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{summary.directorate || "-"}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">{summary.approval_year || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {summary.records_count} قيد
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                        {summary.total_employees.toLocaleString()} موظف
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(summary)}
                        disabled={!isDeleteUnlocked || isDeleting}
                        className={`inline-flex items-center justify-center rounded-lg p-2 transition-all ${
                          !isDeleteUnlocked
                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white"
                        }`}
                        title={!isDeleteUnlocked ? "يتطلب تفعيل صلاحية الحذف" : "حذف السجلات"}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
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
