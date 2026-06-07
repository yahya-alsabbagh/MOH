import { useState, useEffect } from "react";
import { LayoutDashboard, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FileUploadZone from "../components/FileUploadZone";
import DuplicateCheckerCard from "../components/DuplicateCheckerCard";
import TitleValidatorCard from "../components/TitleValidatorCard";
import SortCard from "../components/SortCard";

export default function Home() {
  const [uploadedFilePath, setUploadedFilePath] = useState<string>("");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const navigate = useNavigate();

  return (
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
  );
}
