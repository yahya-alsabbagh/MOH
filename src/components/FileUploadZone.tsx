import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Table2,
  Loader2,
} from "lucide-react";

interface Props {
  onFileUploaded: (filePath: string, headers: string[]) => void;
  onReset: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; filePath: string; fileName: string; headers: string[] }
  | { kind: "error"; message: string };

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export default function FileUploadZone({ onFileUploaded, onReset }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (filePath: string) => {
    setState({ kind: "loading" });
    try {
      const headers = await invoke<string[]>("read_excel_headers", { filePath });
      const fileName = basename(filePath);
      setState({ kind: "ready", filePath, fileName, headers });
      onFileUploaded(filePath, headers);
    } catch (err: any) {
      setState({
        kind: "error",
        message: typeof err === "string" ? err : (err?.message ?? "تعذر قراءة الملف."),
      });
    }
  };

  const zoneRef = useRef<HTMLDivElement>(null);

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
              processFile(path);
            } else {
              console.error("يرجى اختيار ملف بصيغة Excel فقط.");
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

  const chooseFile = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
    });
    if (typeof selected === "string") {
      await processFile(selected);
    }
  };

  const reset = () => {
    setState({ kind: "idle" });
    onReset();
  };

  /* ──────── Loading ──────── */
  if (state.kind === "loading") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-navy-700" />
          <p className="text-sm font-medium text-slate-500">جارٍ قراءة بيانات الملف...</p>
        </div>
      </div>
    );
  }

  /* ──────── Ready ──────── */
  if (state.kind === "ready") {
    return (
      <div className="flex items-center justify-between gap-5 rounded-xl border border-emerald-200 bg-white px-6 py-4 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-slate-800">{state.fileName}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Table2 className="h-3.5 w-3.5" />
                <strong className="text-navy-700">{state.headers.length}</strong> عمود مكتشف:
              </span>
              <span className="text-slate-400">
                {state.headers.slice(0, 5).join(" · ")}
                {state.headers.length > 5 ? " ..." : ""}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 transition-all duration-300 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          رفع ملف جديد وإعادة الضبط
        </button>
      </div>
    );
  }

  /* ──────── Idle / Error ──────── */
  return (
    <div
      ref={zoneRef}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 transition-all duration-300
        ${isDragging 
          ? "border-navy-500 bg-navy-50 shadow-[0_0_40px_rgba(30,58,138,0.15)]" 
          : "border-slate-300 bg-white hover:border-navy-400 hover:bg-slate-50"
        }`}
      onClick={chooseFile}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300
            ${isDragging ? "bg-navy-100" : "bg-slate-100"}`}
        >
          <Upload
            className={`h-7 w-7 transition-colors duration-300
              ${isDragging ? "text-navy-700" : "text-slate-400"}`}
          />
        </div>
        <div>
          <p className="text-base font-bold text-slate-700">
            انقر لاختيار ملف الإكسل أو اسحبه هنا
          </p>
          <p className="mt-1 text-sm text-slate-400">يدعم النظام ملفات xlsx و xls</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); chooseFile(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-navy-700 hover:shadow-md active:scale-95"
        >
          <FileSpreadsheet className="h-4 w-4" />
          رفع ملف الإكسل المراد العمل عليه
        </button>
      </div>

      {state.kind === "error" && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">{state.message}</span>
        </div>
      )}
    </div>
  );
}
