"use client";

import { useState, useRef, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  label: string;
  description?: string;
  acceptedFormats?: string;
  disabled?: boolean;
  fileName?: string;
  loading?: boolean;
  onClear?: () => void;
  variant?: "default" | "compact";
}

export function FileUploader({
  onFileSelect,
  label,
  description,
  acceptedFormats = ".xlsx,.xls",
  disabled = false,
  fileName,
  loading = false,
  onClear,
  variant = "default",
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelect(file);
    },
    [disabled, loading, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (disabled || loading) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // 重置input以便重复选择同一文件
    e.target.value = "";
  };

  if (fileName) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20 p-3",
          variant === "compact" && "p-2"
        )}
      >
        <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 truncate">
            {fileName}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
        {onClear && !loading && (
          <button
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            aria-label="移除文件"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={cn(
        "relative cursor-pointer rounded-lg border-2 border-dashed transition-all",
        "flex flex-col items-center justify-center text-center",
        variant === "default" ? "p-6 gap-2" : "p-4 gap-1",
        isDragging
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-border hover:border-emerald-400 hover:bg-muted/30",
        (disabled || loading) && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleChange}
        className="hidden"
      />
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      ) : (
        <UploadCloud
          className={cn(
            "text-emerald-600",
            variant === "default" ? "h-8 w-8" : "h-6 w-6"
          )}
        />
      )}
      <div>
        <p className="text-sm font-medium text-foreground">
          {loading ? "正在解析..." : label}
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : (
          variant === "default" && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              点击或拖拽上传
            </p>
          )
        )}
      </div>
    </div>
  );
}
