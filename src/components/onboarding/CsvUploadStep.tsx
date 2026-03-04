"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Upload your connections
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the Connections.csv file you downloaded from LinkedIn.
        </p>
      </div>

      {!uploadComplete && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer
            transition-colors
            ${
              isDragging
                ? "border-gray-900 bg-gray-50"
                : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
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

          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Upload className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Drop your Connections.csv here or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                CSV files only
              </p>
            </div>
          </div>
        </div>
      )}

      {(parsing || uploading) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="text-sm font-medium text-gray-900">
              {parsing
                ? "Parsing CSV file..."
                : `Uploading ${connectionCount?.toLocaleString()} connections...`}
            </p>
          </div>
          {uploading && (
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          {fileName && (
            <p className="text-xs text-gray-500">{fileName}</p>
          )}
        </div>
      )}

      {uploadComplete && connectionCount !== null && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {connectionCount.toLocaleString()} connections found
              </p>
              <p className="text-xs text-gray-500">
                Successfully uploaded from {fileName}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {uploadComplete && (
          <Button
            onClick={onNext}
            size="lg"
            className="flex-1 rounded-xl"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
