import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Minus, Maximize, X, ShieldCheck, AlertCircle, Database } from "lucide-react";

import BackdoorModal from "./components/BackdoorModal";
import Home from "./views/Home";
import { useLicense } from "./hooks/useLicense";
import React, { Suspense } from "react";

// Conditionally import DataCenter based on edition
const DataCenter = import.meta.env.VITE_EDITION === 'processing' 
  ? () => (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center rounded-xl bg-slate-100 border border-slate-300 p-8 shadow-sm">
          <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">هذه النسخة مخصصة للمعالجة فقط</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            وفقاً لسياسة فصل الصلاحيات والبيئات، مركز إدارة البيانات والتحليلات غير متوفر في هذه النسخة من التطبيق.
          </p>
        </div>
      </div>
    )
  : React.lazy(() => import("./views/DataCenter"));

const appWindow = getCurrentWindow();

export default function App() {
  const { isLoading, isLocked, isDecoyError, refresh } = useLicense();
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isDeleteUnlocked, setIsDeleteUnlocked] = useState(false);
  const [isUploadUnlocked, setIsUploadUnlocked] = useState(false);
  const [isAnalyticsUnlocked, setIsAnalyticsUnlocked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Read admin & delete status ONCE on app start.
  useEffect(() => {
    invoke<boolean>("get_admin_status")
      .then(setIsAdminUnlocked)
      .catch(console.error);
    invoke<boolean>("get_delete_status")
      .then(setIsDeleteUnlocked)
      .catch(console.error);
    invoke<boolean>("get_upload_status")
      .then(setIsUploadUnlocked)
      .catch(console.error);
    invoke<boolean>("get_analytics_status")
      .then(setIsAnalyticsUnlocked)
      .catch(console.error);
  }, []);

  // DEBUG: log state changes
  useEffect(() => {
    console.log("[STATE CHANGE] isLocked:", isLocked, "isAdminUnlocked:", isAdminUnlocked, "pathname:", location.pathname);
  }, [isLocked, isAdminUnlocked, location.pathname]);

  /* ─── Loading Screen ─── */
  if (isLoading) {
    return (
      <div dir="rtl" className="flex h-screen w-screen items-center justify-center bg-slate-50 font-cairo overflow-hidden">
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
      <div className="flex h-screen w-screen flex-col bg-slate-50 font-sans overflow-hidden">
        <BackdoorModal
          onRenewSuccess={() => {
            refresh();
            invoke<boolean>("get_admin_status").then(setIsAdminUnlocked).catch(console.error);
            invoke<boolean>("get_delete_status").then(setIsDeleteUnlocked).catch(console.error);
            invoke<boolean>("get_upload_status").then(setIsUploadUnlocked).catch(console.error);
            invoke<boolean>("get_analytics_status").then(setIsAnalyticsUnlocked).catch(console.error);
          }}
          isAdminUnlocked={isAdminUnlocked}
          onAdminToggled={(val) => setIsAdminUnlocked(val)}
          isDeleteUnlocked={isDeleteUnlocked}
          onDeleteToggled={(val) => setIsDeleteUnlocked(val)}
          isUploadUnlocked={isUploadUnlocked}
          onUploadToggled={(val) => setIsUploadUnlocked(val)}
          isAnalyticsUnlocked={isAnalyticsUnlocked}
          onAnalyticsToggled={(val) => setIsAnalyticsUnlocked(val)}
        />
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
    <div dir="rtl" className="flex h-screen w-screen flex-col bg-slate-50 font-cairo overflow-hidden relative print:h-auto print:w-auto print:overflow-visible">
      <BackdoorModal
        onRenewSuccess={() => {
          refresh();
          invoke<boolean>("get_admin_status").then(setIsAdminUnlocked).catch(console.error);
          invoke<boolean>("get_delete_status").then(setIsDeleteUnlocked).catch(console.error);
          invoke<boolean>("get_upload_status").then(setIsUploadUnlocked).catch(console.error);
          invoke<boolean>("get_analytics_status").then(setIsAnalyticsUnlocked).catch(console.error);
        }}
        isAdminUnlocked={isAdminUnlocked}
        onAdminToggled={(val) => setIsAdminUnlocked(val)}
        isDeleteUnlocked={isDeleteUnlocked}
        onDeleteToggled={(val) => setIsDeleteUnlocked(val)}
        isUploadUnlocked={isUploadUnlocked}
        onUploadToggled={(val) => setIsUploadUnlocked(val)}
        isAnalyticsUnlocked={isAnalyticsUnlocked}
        onAnalyticsToggled={(val) => setIsAnalyticsUnlocked(val)}
      />

      {/* ── Custom Title Bar / Header ── */}
      <header data-tauri-drag-region className="flex h-14 w-full flex-shrink-0 items-center justify-between bg-navy-900 px-5 shadow-md print:hidden">
        {/* Left: System Name & Icon */}
        <div data-tauri-drag-region className="flex flex-1 items-center gap-3 select-none">
          <div data-tauri-drag-region className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck data-tauri-drag-region className="h-4 w-4 text-white" />
          </div>
          <div data-tauri-drag-region>
            <h1 data-tauri-drag-region className="text-sm font-bold leading-tight text-white">
              نظام الملاك الوظيفي الذكي
            </h1>
            <p data-tauri-drag-region className="text-xs leading-tight text-navy-200">دائرة الموازنة - قسم التنسيق والاحصاء</p>
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
      <main className={`flex-1 overflow-y-auto p-5 print:overflow-visible print:h-auto ${location.pathname !== "/data-center" ? "pb-20" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/data-center" element={
            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
              <DataCenter isDeleteUnlocked={isDeleteUnlocked} isUploadUnlocked={isUploadUnlocked} isAnalyticsUnlocked={isAnalyticsUnlocked} />
            </Suspense>
          } />
        </Routes>
      </main>

      {/* Copyright Footer */}
      <div className="absolute bottom-2 left-4 z-50 pointer-events-none select-none print:hidden">
        <p className="text-xs font-medium text-slate-400 opacity-70">© Yahya Hafedh ALsabbagh 2026</p>
      </div>

      {/* Data Center Floating Button */}
      {isAdminUnlocked && location.pathname !== "/data-center" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => navigate("/data-center")}
            className="flex items-center gap-2 rounded-full bg-gradient-to-l from-indigo-600 to-indigo-800 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <Database className="h-5 w-5" />
            مركز إدارة البيانات والتحليلات
          </button>
        </div>
      )}
    </div>
  );
}
