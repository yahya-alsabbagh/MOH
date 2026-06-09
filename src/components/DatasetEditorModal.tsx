import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Save, Plus, Trash2, Loader2, Database, FileSpreadsheet } from "lucide-react";
import { confirm, message, save } from "@tauri-apps/plugin-dialog";

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

interface DatasetEditorModalProps {
  ministry: string;
  directorate: string;
  approvalYear: number;
  onClose: () => void;
  onSuccess: () => void;
}

const gradeWeight = (g?: string) => {
  if (!g) return 99;
  const clean = g.trim().replace('أ', 'ا');
  if (clean === "عليا ا" || clean === "عليا أ" || clean === "عليا ا ") return 1;
  if (clean === "عليا ب" || clean === "عليا ب ") return 2;
  if (clean === "1" || clean === "الاولى" || clean === "الأولى") return 3;
  if (clean === "2" || clean === "الثانية") return 4;
  if (clean === "3" || clean === "الثالثة") return 5;
  if (clean === "4" || clean === "الرابعة") return 6;
  if (clean === "5" || clean === "الخامسة") return 7;
  if (clean === "6" || clean === "السادسة") return 8;
  if (clean === "7" || clean === "السابعة") return 9;
  if (clean === "8" || clean === "الثامنة") return 10;
  if (clean === "9" || clean === "التاسعة") return 11;
  if (clean === "10" || clean === "العاشرة") return 12;
  return 99;
};

const mapGradeToArabic = (grade?: string) => {
  const g = (grade || "").trim();
  switch(g) {
      case "1": return "الأولى";
      case "2": return "الثانية";
      case "3": return "الثالثة";
      case "4": return "الرابعة";
      case "5": return "الخامسة";
      case "6": return "السادسة";
      case "7": return "السابعة";
      case "8": return "الثامنة";
      case "9": return "التاسعة";
      case "10": return "العاشرة";
      default: return g;
  }
};

export default function DatasetEditorModal({ ministry, directorate, approvalYear, onClose, onSuccess }: DatasetEditorModalProps) {
  const [records, setRecords] = useState<DepartmentMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [ministry, directorate, approvalYear]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<DepartmentMetric[]>("fetch_dataset_details", {
        ministry,
        directorate,
        approvalYear,
      });
      // Sort initially
      data.sort((a, b) => gradeWeight(a.job_grade) - gradeWeight(b.job_grade));
      setRecords(data);
    } catch (error) {
      console.error(error);
      message("فشل في جلب بيانات التشكيل.", { kind: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRow = () => {
    const newRecord: DepartmentMetric = {
      id: Date.now(), // Temporary ID
      ministry,
      directorate,
      approval_year: approvalYear,
      job_title: "",
      job_grade: "",
      job_code: "",
      male_count: 0,
      female_count: 0,
      vacant_count: 0,
      total_count: 0,
    };
    // Add to top and re-sort
    const updated = [newRecord, ...records];
    updated.sort((a, b) => gradeWeight(a.job_grade) - gradeWeight(b.job_grade));
    setRecords(updated);
  };

  const handleRemoveRow = (idx: number) => {
    const updated = [...records];
    updated.splice(idx, 1);
    setRecords(updated);
  };

  const handleChange = (idx: number, field: keyof DepartmentMetric, value: string | number) => {
    const updated = [...records];
    const rec = { ...updated[idx], [field]: value };

    // Auto calculate total if male, female, vacant changed
    if (field === "male_count" || field === "female_count" || field === "vacant_count") {
      const m = parseInt((rec.male_count as any) || "0", 10);
      const f = parseInt((rec.female_count as any) || "0", 10);
      const v = parseInt((rec.vacant_count as any) || "0", 10);
      rec.total_count = m + f + v;
    }

    updated[idx] = rec;
    // Re-sort when grade changes
    if (field === "job_grade") {
      updated.sort((a, b) => gradeWeight(a.job_grade) - gradeWeight(b.job_grade));
    }
    setRecords(updated);
  };

  const handleSave = async () => {
    // Basic validation
    const hasEmptyTitles = records.some(r => !r.job_title?.trim());
    if (hasEmptyTitles) {
      const proceed = await confirm("يوجد حقول (العنوان الوظيفي) فارغة، هل ترغب في المتابعة رغم ذلك؟", { title: "تنبيه", kind: "warning" });
      if (!proceed) return;
    }

    setIsSaving(true);
    try {
      const count = await invoke<number>("update_dataset_records", {
        ministry,
        directorate,
        approvalYear,
        records: records.map(r => ({
          ...r,
          male_count: parseInt(r.male_count as any) || 0,
          female_count: parseInt(r.female_count as any) || 0,
          vacant_count: parseInt(r.vacant_count as any) || 0,
          total_count: parseInt(r.total_count as any) || 0,
        })),
      });

      await message(`تم حفظ التعديلات وتحديث ${count} قيد بنجاح!`, { title: "نجاح", kind: "info" });
      onSuccess();
    } catch (error: any) {
      console.error(error);
      message(typeof error === "string" ? error : "حدث خطأ أثناء حفظ التعديلات", { title: "خطأ", kind: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const suggestedName = `الملاكات_${directorate}_${ministry}_${approvalYear}.xlsx`.replace(/\s+/g, '_');
      const filePath = await save({
        title: "تصدير جدول التشكيل",
        defaultPath: suggestedName,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });

      if (!filePath) return;

      setIsExporting(true);
      await invoke("export_dataset_to_excel", {
        outputPath: filePath,
        ministry,
        directorate,
        approvalYear,
        records: records.map(r => ({
          ...r,
          male_count: parseInt(r.male_count as any) || 0,
          female_count: parseInt(r.female_count as any) || 0,
          vacant_count: parseInt(r.vacant_count as any) || 0,
          total_count: parseInt(r.total_count as any) || 0,
        })),
      });

      await message("تم تصدير الجدول كملف إكسل بنجاح!", { title: "نجاح", kind: "info" });
    } catch (error: any) {
      console.error(error);
      message(typeof error === "string" ? error : "حدث خطأ أثناء التصدير", { title: "خطأ", kind: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  // Grouping logic for rendering
  const gradeGroups = React.useMemo(() => {
    const groups: { grade: string; records: (DepartmentMetric & { originalIndex: number })[] }[] = [];
    
    records.forEach((rec, i) => {
      const g = rec.job_grade || "";
      let group = groups.find(x => x.grade === g);
      if (!group) {
        group = { grade: g, records: [] };
        groups.push(group);
      }
      group.records.push({ ...rec, originalIndex: i });
    });
    return groups;
  }, [records]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" dir="rtl">
      <div className="flex h-[90vh] w-[95vw] max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-col">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <Database className="h-6 w-6 text-indigo-600" />
              تعديل تفاصيل التشكيل
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {directorate} - {ministry} ({approvalYear})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" />
              إضافة قيد جديد
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button
              onClick={() => handleExport()}
              disabled={isExporting || isLoading || records.length === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-50"
              title="تصدير كملف إكسل"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              تصدير
            </button>
          </div>
          <div className="text-sm font-bold text-slate-600">
            إجمالي القيود: {records.length}
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center flex-col text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-semibold">جاري جلب القيود للتعديل...</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 font-semibold w-8 text-center">#</th>
                    <th className="px-4 py-3 font-semibold">العنوان الوظيفي</th>
                    <th className="px-4 py-3 font-semibold w-24">الدرجة</th>
                    <th className="px-4 py-3 font-semibold w-24">الرمز</th>
                    <th className="px-3 py-3 font-semibold w-20 text-center">الذكور</th>
                    <th className="px-3 py-3 font-semibold w-20 text-center">الإناث</th>
                    <th className="px-3 py-3 font-semibold w-20 text-center">الشواغر</th>
                    <th className="px-3 py-3 font-semibold w-24 text-center">المجموع</th>
                    <th className="px-3 py-3 font-semibold w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold">
                        لا توجد قيود، يمكنك إضافة قيود جديدة.
                      </td>
                    </tr>
                  ) : (
                    gradeGroups.map((group, gIdx) => {
                      const groupMales = group.records.reduce((acc, r) => acc + (parseInt(r.male_count as any) || 0), 0);
                      const groupFemales = group.records.reduce((acc, r) => acc + (parseInt(r.female_count as any) || 0), 0);
                      const groupVacants = group.records.reduce((acc, r) => acc + (parseInt(r.vacant_count as any) || 0), 0);
                      const groupTotal = group.records.reduce((acc, r) => acc + (parseInt(r.total_count as any) || 0), 0);
                      const gradeLabel = group.grade ? mapGradeToArabic(group.grade) : "غير محدد";

                      return (
                        <React.Fragment key={gIdx}>
                          {group.records.map((r, i) => {
                            const idx = r.originalIndex;
                            return (
                              <tr key={r.id.toString() + idx.toString()} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={r.job_title || ""}
                                    onChange={(e) => handleChange(idx, "job_title", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
                                    placeholder="العنوان الوظيفي"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={r.job_grade || ""}
                                    onChange={(e) => handleChange(idx, "job_grade", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-center font-bold"
                                    placeholder="الدرجة"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={r.job_code || ""}
                                    onChange={(e) => handleChange(idx, "job_code", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-center"
                                    placeholder="الرمز"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={r.male_count ?? ""}
                                    onChange={(e) => handleChange(idx, "male_count", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-center"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={r.female_count ?? ""}
                                    onChange={(e) => handleChange(idx, "female_count", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-center"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={r.vacant_count ?? ""}
                                    onChange={(e) => handleChange(idx, "vacant_count", e.target.value)}
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 text-center"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={r.total_count ?? ""}
                                    readOnly
                                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-bold text-indigo-700 bg-slate-50 outline-none text-center cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => handleRemoveRow(idx)}
                                    className="rounded p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                    title="حذف القيد"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {/* Subtotal Row */}
                          {group.grade && group.grade.trim() !== "" && (
                            <tr className="bg-yellow-200/60 text-slate-800 font-bold border-y-2 border-yellow-300">
                              <td className="px-3 py-2 text-center text-slate-500">*</td>
                              <td colSpan={3} className="px-4 py-3 text-center">
                                مجموع الدرجة {gradeLabel}
                              </td>
                              <td className="px-3 py-3 text-center">{groupMales}</td>
                              <td className="px-3 py-3 text-center">{groupFemales}</td>
                              <td className="px-3 py-3 text-center">{groupVacants}</td>
                              <td className="px-3 py-3 text-center bg-yellow-300/50 text-indigo-900">{groupTotal}</td>
                              <td className="px-3 py-3"></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                  {records.length > 0 && (
                    <tr className="bg-indigo-100 text-indigo-900 font-bold border-t-4 border-indigo-200 shadow-sm">
                      <td className="px-3 py-3 text-center text-indigo-400">*</td>
                      <td colSpan={3} className="px-4 py-4 text-center text-lg">
                        المجموع الكلي
                      </td>
                      <td className="px-3 py-4 text-center text-base">
                        {records.reduce((acc, r) => acc + (parseInt(r.male_count as any) || 0), 0)}
                      </td>
                      <td className="px-3 py-4 text-center text-base">
                        {records.reduce((acc, r) => acc + (parseInt(r.female_count as any) || 0), 0)}
                      </td>
                      <td className="px-3 py-4 text-center text-base">
                        {records.reduce((acc, r) => acc + (parseInt(r.vacant_count as any) || 0), 0)}
                      </td>
                      <td className="px-3 py-4 text-center text-lg text-indigo-700 bg-indigo-200/50">
                        {records.reduce((acc, r) => acc + (parseInt(r.total_count as any) || 0), 0)}
                      </td>
                      <td className="px-3 py-4"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white p-5">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
            disabled={isSaving}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}
