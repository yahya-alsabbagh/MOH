import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Loader2,
  TableProperties,
  Upload,
} from "lucide-react";

export default function SortCard() {
  const [matchingFilePath, setMatchingFilePath] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  
  type ResultState =
    | { kind: "idle" }
    | { kind: "success"; outputPath: string }
    | { kind: "error"; message: string };

  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  const chooseFile = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
    });
    if (typeof selected === "string") {
      setMatchingFilePath(selected);
      setResult({ kind: "idle" });
    }
  };

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onDragDropEvent((event) => {
      let isInside = false;
      if (zoneRef.current && "position" in event.payload && (event.payload as any).position) {
        const payload = event.payload as any;
        const rect = zoneRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = payload.position.x / dpr;
        const y = payload.position.y / dpr;
        isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      }

      if (event.payload.type === "over") {
        setIsDragging(isInside);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        if (isInside) {
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            const path = paths[0];
            if (path.endsWith(".xlsx") || path.endsWith(".xls")) {
              setMatchingFilePath(path);
              setResult({ kind: "idle" });
            }
          }
        }
      } else {
        setIsDragging(false);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const run = async () => {
    setResult({ kind: "idle" });
    if (!matchingFilePath) {
      setResult({ kind: "error", message: "يرجى اختيار ملف المطابقة أولاً." });
      return;
    }
    setIsProcessing(true);
    try {
      const outputPath = await invoke<string>("run_aggregation", {
        filePath: matchingFilePath,
      });
      setResult({ kind: "success", outputPath });
    } catch (err: any) {
      setResult({
        kind: "error",
        message:
          typeof err === "string" ? err : (err?.message ?? "تعذر إتمام الفرز والتجميع."),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  function basename(path: string) {
    return path.replace(/\\/g, "/").split("/").pop() || path;
  }

  return (
    <div
      ref={zoneRef}
      className={`group relative overflow-hidden flex flex-col rounded-xl border bg-white p-5 shadow-card transition-all duration-300 border-slate-200 hover:border-amber-200 hover:shadow-card-hover`}
    >
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 shadow-inner">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
          <p className="text-sm font-bold text-slate-800">جاري المعالجة...</p>
          <p className="mt-1 text-xs font-medium text-slate-500">يتم بناء ملف الفرز الإحصائي</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors duration-300">
          <TableProperties className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">فرز الإحصائية</h3>
          <p className="text-xs text-slate-400">حساب الأعداد للملاكات وتجميعها</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        
        {/* Upload Button */}
        <div 
          onClick={chooseFile}
          className={`relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-all duration-300
            ${isDragging ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-amber-300"}
            ${matchingFilePath ? "border-emerald-300 bg-emerald-50" : ""}
          `}
        >
          {matchingFilePath ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 truncate w-full px-2" dir="ltr">
                {basename(matchingFilePath)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className={`h-6 w-6 ${isDragging ? "text-amber-500" : "text-slate-400"}`} />
              <span className="text-xs font-medium text-slate-500">
                اختر أو اسحب ملف المطابقة هنا
              </span>
            </div>
          )}
        </div>

        {/* Run Button */}
        <button
          type="button"
          onClick={run}
          disabled={!matchingFilePath || isProcessing}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-amber-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TableProperties className="h-4 w-4" />
          )}
          {isProcessing ? "جارٍ الفرز..." : "بدء الفرز"}
        </button>

        {/* Result */}
        {result.kind === "success" && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="mb-0.5 font-bold">تم الفرز بنجاح ✓</div>
              <div className="break-all text-emerald-700">{result.outputPath}</div>
            </div>
          </div>
        )}
        {result.kind === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
            <span className="font-medium">{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
