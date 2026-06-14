import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { X, User, Landmark, Building2, CalendarDays, Hash, Download, Loader2, Database } from "lucide-react";

export interface SelectedEmployeeData {
  original_name: string;
  normalized_name: string;
  ministry?: string;
  directorate?: string;
  approval_year?: number;
  row_number: number | null;
  data_columns: Record<string, unknown>;
}

interface EmployeeDetailsModalProps {
  employee: SelectedEmployeeData;
  onClose: () => void;
}

export default function EmployeeDetailsModal({ employee, onClose }: EmployeeDetailsModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const dataEntries = Object.entries(employee.data_columns).filter(([_, v]) => v !== null && v !== "");

  const handleExport = async () => {
    try {
      const outputPath = await save({
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
        defaultPath: `تفاصيل_${employee.original_name.replace(/\s+/g, "_")}.xlsx`,
      });
      
      if (!outputPath) return;

      setIsExporting(true);
      
      await invoke("export_single_employee_to_excel", {
        outputPath,
        employee,
      });
      
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-indigo-50/50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-indigo-100">
              <User className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {employee.original_name}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-semibold">
                {employee.ministry && (
                  <span className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-indigo-400" />
                    {employee.ministry}
                  </span>
                )}
                {employee.directorate && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                    {employee.directorate}
                  </span>
                )}
                {employee.approval_year && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
                    {employee.approval_year}
                  </span>
                )}
                {employee.row_number !== null && (
                  <span className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-rose-400" />
                    ت: {employee.row_number}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {dataEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Database className="h-12 w-12 mb-3 text-slate-300" />
              <p className="text-sm font-semibold">لا توجد تفاصيل إضافية مسجلة لهذا الموظف</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataEntries.map(([key, value], idx) => {
                let displayValue = String(value);
                if (typeof value === "number") {
                  displayValue = value.toLocaleString("en-US");
                }
                return (
                  <div key={idx} className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-indigo-100">
                    <span className="text-xs font-bold text-slate-500">{key}</span>
                    <span className="text-sm font-semibold text-slate-800 break-words">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white rounded-b-2xl shrink-0 flex items-center justify-between">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تصدير إلى إكسل
          </button>
          
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-6 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
