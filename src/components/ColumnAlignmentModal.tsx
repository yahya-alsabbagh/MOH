import { useState } from "react";
import { ArrowLeftRight, Check, Plus, X, AlertTriangle } from "lucide-react";

interface ColumnAlignment {
  original: string;
  suggested: string | null;
  similarity: number;
  is_new: boolean;
}

interface ColumnAlignmentModalProps {
  alignments: ColumnAlignment[];
  onConfirm: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

export default function ColumnAlignmentModal({
  alignments,
  onConfirm,
  onCancel,
}: ColumnAlignmentModalProps) {
  // For each alignment, track whether user wants to unify (use suggested) or keep original
  const [decisions, setDecisions] = useState<Record<string, "unify" | "keep">>(
    () => {
      const initial: Record<string, "unify" | "keep"> = {};
      for (const a of alignments) {
        // Default to "unify" for high similarity matches
        initial[a.original] = a.similarity >= 80 ? "unify" : "keep";
      }
      return initial;
    }
  );

  const handleDecision = (original: string, decision: "unify" | "keep") => {
    setDecisions((prev) => ({
      ...prev,
      [original]: decision,
    }));
  };

  const handleConfirm = () => {
    const mapping: Record<string, string> = {};
    for (const a of alignments) {
      if (decisions[a.original] === "unify" && a.suggested) {
        mapping[a.original] = a.suggested;
      }
    }
    onConfirm(mapping);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                مطابقة الأعمدة
              </h3>
              <p className="text-xs text-slate-500">
                تم اكتشاف أعمدة متشابهة مع أعمدة موجودة مسبقاً في قاعدة
                البيانات
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="max-h-[400px] overflow-auto px-6 py-4">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                <th className="pb-2 pr-2">عمود الإكسل الجديد</th>
                <th className="pb-2 text-center">
                  <ArrowLeftRight className="mx-auto h-3.5 w-3.5" />
                </th>
                <th className="pb-2">العمود المقترح (الموجود)</th>
                <th className="pb-2 text-center">التشابه</th>
                <th className="pb-2 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {alignments.map((a) => {
                const isUnify = decisions[a.original] === "unify";
                return (
                  <tr
                    key={a.original}
                    className="transition-colors hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-2">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold ${
                          isUnify
                            ? "bg-slate-100 text-slate-400 line-through"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {a.original}
                      </span>
                    </td>
                    <td className="py-3 text-center text-slate-300">→</td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold ${
                          isUnify
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {a.suggested || "—"}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          a.similarity >= 90
                            ? "bg-rose-50 text-rose-600"
                            : a.similarity >= 80
                              ? "bg-amber-50 text-amber-600"
                              : "bg-sky-50 text-sky-600"
                        }`}
                      >
                        {a.similarity}%
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDecision(a.original, "unify")}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            isUnify
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          توحيد
                        </button>
                        <button
                          onClick={() => handleDecision(a.original, "keep")}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                            !isUnify
                              ? "bg-blue-500 text-white shadow-sm"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <Plus className="h-3 w-3" />
                          إبقاء جديد
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-400">
            اختر "توحيد" لدمج العمود مع الموجود، أو "إبقاء جديد" لإنشاء عمود
            مستقل.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              تأكيد ومتابعة الرفع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
