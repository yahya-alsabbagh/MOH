import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Maximize, X, ShieldCheck, LayoutDashboard, AlertCircle } from "lucide-react";

import BackdoorModal from "./components/BackdoorModal";
import FileUploadZone from "./components/FileUploadZone";
import DuplicateCheckerCard from "./components/DuplicateCheckerCard";
import TitleValidatorCard from "./components/TitleValidatorCard";
import SortCard from "./components/SortCard";
import { useLicense } from "./hooks/useLicense";

const appWindow = getCurrentWindow();

export default function App() {
  const { isLoading, isLocked, isDecoyError, refresh } = useLicense();
  const [uploadedFilePath, setUploadedFilePath] = useState<string>("");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

  /* ─── Loading Screen ─── */
  if (isLoading) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 font-cairo">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-200 border-t-navy-800" />
          <p className="text-sm font-semibold text-slate-500">جارٍ تهيئة النظام...</p>
        </div>
      </div>
    );
  }

  /* ─── Locked / Decoy Screen ─── */
  if (isLocked) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
        <BackdoorModal onRenewSuccess={refresh} />
        {/* Custom title bar for locked screen */}
        <div
          data-tauri-drag-region
          className="flex h-10 w-full items-center justify-between bg-slate-100 px-4 border-b border-slate-200"
        >
          <span data-tauri-drag-region className="text-xs font-semibold text-slate-700 select-none">
            System Error
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => appWindow.close()}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-rose-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-8 bg-white">
          <div className="w-full max-w-lg flex items-start gap-4 p-6">
            <AlertCircle className="h-12 w-12 text-rose-600 flex-shrink-0" />
            <div className="text-left" dir="ltr">
              <h1 className="mb-2 text-lg font-bold text-slate-900">Missing or Outdated Dependency</h1>
              <p className="text-sm leading-relaxed text-slate-700">
                It has been detected that the installed PyQt6 Commercial Edition is either outdated or unavailable. 
                This library is required for the program to run stably and compatibly with its current functionalities. 
                Please ensure that the latest version of PyQt6 Commercial Edition is available to avoid any malfunctions 
                or performance interruptions. For more details on how to update, please refer to the official documentation 
                on the library's official website.
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => appWindow.close()}
                  className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-sm font-medium transition"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main Application ─── */
  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-slate-50 font-cairo">
      <BackdoorModal onRenewSuccess={refresh} />

      {/* ── Custom Title Bar / Header ── */}
      <header data-tauri-drag-region className="flex h-14 w-full flex-shrink-0 items-center justify-between bg-navy-900 px-5 shadow-md">
        {/* Left: System Name & Icon */}
        <div data-tauri-drag-region className="flex flex-1 items-center gap-3 select-none">
          <div data-tauri-drag-region className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck data-tauri-drag-region className="h-4 w-4 text-white" />
          </div>
          <div data-tauri-drag-region>
            <h1 data-tauri-drag-region className="text-sm font-bold leading-tight text-white">
              نظام التدقيق الرقمي الذكي
            </h1>
            <p data-tauri-drag-region className="text-xs leading-tight text-navy-200">منصة التدقيق المؤسسي للبيانات الوظيفية</p>
          </div>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => appWindow.minimize()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-navy-200 transition-all duration-200 hover:bg-white/10 hover:text-white"
            title="تصغير"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-navy-200 transition-all duration-200 hover:bg-white/10 hover:text-white"
            title="تكبير/استعادة"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-navy-200 transition-all duration-200 hover:bg-rose-500 hover:text-white"
            title="إغلاق"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">

          {/* Section Title */}
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-500">لوحة أدوات المعالجة</span>
          </div>

          {/* ── File Upload Zone ── */}
          <FileUploadZone
            onFileUploaded={(path, headers) => {
              setUploadedFilePath(path);
              setExcelHeaders(headers);
            }}
            onReset={() => {
              setUploadedFilePath("");
              setExcelHeaders([]);
            }}
          />

          {/* ── Action Cards Grid ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DuplicateCheckerCard
              filePath={uploadedFilePath}
              headers={excelHeaders}
            />
            <TitleValidatorCard workFilePath={uploadedFilePath} headers={excelHeaders} />
            <SortCard />
          </div>

          {/* Status Bar */}
          {!uploadedFilePath && (
            <p className="text-center text-xs text-slate-400">
              ارفع ملف الإكسل أعلاه لتفعيل أدوات المعالجة
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
