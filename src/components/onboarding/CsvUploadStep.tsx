"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileSpreadsheet } from "lucide-react";

interface CsvUploadStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const REQUIRED_COLUMNS = [
  "First Name",
  "Last Name",
  "Email Address",
  "Company",
  "Position",
  "Connected On",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(
  headers: string[],
  required: string
): string | null {
  const normalizedRequired = normalizeHeader(required);
  for (const header of headers) {
    if (normalizeHeader(header) === normalizedRequired) {
      return header;
    }
  }
  return null;
}

export default function CsvUploadStep({
  userId,
  onNext,
  onBack,
}: CsvUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState<number | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setConnectionCount(null);
      setUploadComplete(false);
      setUploadProgress(0);

      if (!file.name.endsWith(".csv")) {
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          setError(
            "Please upload a .csv file. LinkedIn exports are in CSV format."
          );
        } else {
          setError("Please upload a .csv file.");
        }
        return;
      }

      setFileName(file.name);
      setParsing(true);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          setParsing(false);

          if (!results.data || results.data.length === 0) {
            setError("The CSV file appears to be empty.");
            return;
          }

          const headers = results.meta.fields || [];
          const missingColumns: string[] = [];

          const columnMap: Record<string, string> = {};
          for (const required of REQUIRED_COLUMNS) {
            const found = findColumn(headers, required);
            if (!found) {
              missingColumns.push(required);
            } else {
              columnMap[required] = found;
            }
          }

          if (missingColumns.length > 0) {
            setError(
              `Missing required column: ${missingColumns[0]}`
            );
            return;
          }

          const rows = results.data as Record<string, string>[];
          const validRows = rows.filter(
            (row) =>
              row[columnMap["First Name"]]?.trim() ||
              row[columnMap["Last Name"]]?.trim()
          );

          setConnectionCount(validRows.length);

          if (validRows.length === 0) {
            setError("No valid connections found in the CSV.");
            return;
          }

          setUploading(true);
          setUploadProgress(10);

          try {
            const connections = validRows.map((row) => ({
              first_name: row[columnMap["First Name"]]?.trim() || "",
              last_name: row[columnMap["Last Name"]]?.trim() || "",
              email_address: row[columnMap["Email Address"]]?.trim() || "",
              company: row[columnMap["Company"]]?.trim() || "",
              position: row[columnMap["Position"]]?.trim() || "",
              connected_on: row[columnMap["Connected On"]]?.trim() || "",
            }));

            setUploadProgress(30);

            const res = await fetch("/api/onboarding/csv-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, connections }),
            });

            setUploadProgress(80);

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "Failed to upload connections");
            }

            setUploadProgress(100);
            setUploadComplete(true);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to upload connections"
            );
          } finally {
            setUploading(false);
          }
        },
        error: () => {
          setParsing(false);
          setError("Failed to parse the CSV file. Please check the format.");
        },
      });
    },
    [userId]
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <Upload className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Upload your connections
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            Upload the Connections.csv file you downloaded from LinkedIn.
          </p>
        </div>
      </div>

      {/* Drag-and-drop zone */}
      {!uploadComplete && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer
            transition-all duration-300 ease-out group
            ${
              isDragging
                ? "border-accent bg-accent-light scale-[1.01] shadow-lg shadow-accent/10"
                : "border-warm-300 bg-warm-50 hover:border-accent hover:bg-accent-light/50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-4">
            <div
              className={`
                flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300
                ${isDragging ? "bg-accent/15 scale-110" : "bg-warm-100 group-hover:bg-accent/10"}
              `}
            >
              <FileSpreadsheet
                className={`h-7 w-7 transition-colors duration-300 ${
                  isDragging ? "text-accent" : "text-warm-400 group-hover:text-accent"
                }`}
                strokeWidth={1.5}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm sm:text-base font-semibold text-foreground">
                Drop your Connections.csv here
              </p>
              <p className="text-sm text-warm-400">
                or <span className="text-accent font-medium underline underline-offset-2">click to browse</span>
              </p>
            </div>
            <span className="rounded-full bg-warm-100 px-3 py-1.5 text-xs font-medium text-warm-500">
              CSV files only
            </span>
          </div>
        </div>
      )}

      {/* Parsing / uploading progress */}
      {(parsing || uploading) && (
        <div className="card-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-warm-200 border-t-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {parsing
                  ? "Parsing CSV file..."
                  : `Uploading ${connectionCount?.toLocaleString()} connections...`}
              </p>
              {fileName && (
                <p className="text-xs text-warm-400 mt-0.5">{fileName}</p>
              )}
            </div>
          </div>
          {uploading && (
            <div className="h-2 rounded-full bg-warm-100 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {uploadComplete && connectionCount !== null && (
        <div className="card-elevated p-6 sm:p-8 space-y-4 animate-scale-in">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 animate-scale-in">
              <CheckCircle className="h-8 w-8 text-accent" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-foreground">
                {connectionCount.toLocaleString()} connections found
              </p>
              <p className="text-sm text-warm-400">
                Successfully uploaded from {fileName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {uploadComplete && (
          <Button
            onClick={onNext}
            size="lg"
            className="flex-1 h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
