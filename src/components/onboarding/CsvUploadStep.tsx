"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";

interface CsvUploadStepProps {
  userId: string;
  onNext: (uploadResult?: { mode: string; connections: number; tracking_token?: string }) => void;
  onBack: () => void;
}

/* ─── Bulletproof header mapping ─── */
const HEADER_MAP: Record<string, string> = {
  // First name
  "first name": "first_name",
  firstname: "first_name",
  first_name: "first_name",
  first: "first_name",
  "given name": "first_name",
  givenname: "first_name",

  // Last name
  "last name": "last_name",
  lastname: "last_name",
  last_name: "last_name",
  last: "last_name",
  surname: "last_name",
  "family name": "last_name",
  familyname: "last_name",

  // LinkedIn URL
  url: "linkedin_url",
  "linkedin url": "linkedin_url",
  linkedin_url: "linkedin_url",
  "profile url": "linkedin_url",
  profile_url: "linkedin_url",
  "profile link": "linkedin_url",
  linkedin: "linkedin_url",
  "linkedin profile": "linkedin_url",
  link: "linkedin_url",

  // Email
  "email address": "email_address",
  email_address: "email_address",
  emailaddress: "email_address",
  email: "email_address",
  "e-mail": "email_address",
  "e-mail address": "email_address",
  mail: "email_address",

  // Company
  company: "company",
  "company name": "company",
  company_name: "company",
  organization: "company",
  organisation: "company",
  employer: "company",
  "current company": "company",

  // Position / Title
  position: "position",
  title: "position",
  "job title": "position",
  job_title: "position",
  jobtitle: "position",
  role: "position",
  designation: "position",
  "current position": "position",
  "current title": "position",

  // Connected On
  "connected on": "connected_on",
  connected_on: "connected_on",
  connectedon: "connected_on",
  "connection date": "connected_on",
  connection_date: "connected_on",
  "date connected": "connected_on",
  date: "connected_on",
  connected: "connected_on",
  "connected date": "connected_on",
};

/* ─── Date parsing for all LinkedIn locale formats ─── */
function parseLinkedInDate(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;

  const cleaned = dateStr.trim();

  // Try "28 Jan 2026" or "28 January 2026" (day month year)
  const dmy = cleaned.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
  if (dmy) {
    const month = monthToNum(dmy[2]);
    if (month) return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
  }

  // Try "Jan 28, 2026" or "January 28, 2026" (month day, year)
  const mdy = cleaned.match(/(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy) {
    const month = monthToNum(mdy[1]);
    if (month) return `${mdy[3]}-${month}-${mdy[2].padStart(2, "0")}`;
  }

  // Try ISO "2026-01-28"
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return cleaned;

  // Try US "01/28/2026" or international "28/01/2026"
  const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    // If first number > 12, it must be day (international format)
    if (a > 12) {
      return `${slash[3]}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    // Default to US format (month/day/year)
    return `${slash[3]}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }

  // Fallback: try native Date parser
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }

  return null;
}

function monthToNum(m: string): string | null {
  const map: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  return map[m.toLowerCase()] || null;
}

/* ─── URL cleaning ─── */
function cleanLinkedInUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  let cleaned = url.trim();
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");
  // Ensure https://
  if (cleaned.startsWith("http://"))
    cleaned = cleaned.replace("http://", "https://");
  if (!cleaned.startsWith("https://")) cleaned = "https://" + cleaned;
  // Remove query params (tracking params)
  cleaned = cleaned.split("?")[0];
  return cleaned;
}

/* ─── Parsed connection type ─── */
interface ParsedConnection {
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email_address: string;
  company: string;
  position: string;
  connected_on: string | null;
}

/* ─── Component ─── */
export default function CsvUploadStep({
  userId,
  onNext,
  onBack,
}: CsvUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionCount, setConnectionCount] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  // Preview state: parsed connections ready to upload
  const [parsedConnections, setParsedConnections] = useState<ParsedConnection[] | null>(null);

  const parseFile = useCallback(
    async (file: File) => {
      // Guard against concurrent parse calls (double-drop, onChange + onDrop)
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setError(null);
      setConnectionCount(null);
      setSkippedCount(0);
      setUploadComplete(false);
      setUploadProgress(0);
      setParsedConnections(null);

      if (!file.name.endsWith(".csv")) {
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          setError(
            "Please upload a .csv file. LinkedIn exports are in CSV format."
          );
        } else {
          setError("Please upload a .csv file.");
        }
        isProcessingRef.current = false;
        return;
      }

      setFileName(file.name);
      setParsing(true);

      // Read file as text and strip BOM
      const fileContent = await file.text();
      const cleanedContent = fileContent.replace(/^\uFEFF/, "");

      Papa.parse(cleanedContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsing(false);
          isProcessingRef.current = false;

          if (!results.data || results.data.length === 0) {
            setError("The CSV file appears to be empty.");
            return;
          }

          // Build column mapping: CSV header → DB column
          const rawHeaders = results.meta.fields || [];
          const columnMapping: Record<string, string> = {};
          const unmatchedHeaders: string[] = [];

          for (const header of rawHeaders) {
            const normalized = header
              .trim()
              .toLowerCase()
              .replace(/^\uFEFF/, "")
              .replace(/^["']|["']$/g, "");
            const dbColumn = HEADER_MAP[normalized];
            if (dbColumn) {
              columnMapping[header] = dbColumn;
            } else if (normalized) {
              unmatchedHeaders.push(header);
            }
          }

          if (unmatchedHeaders.length > 0) {
            console.warn("Unmatched CSV headers:", unmatchedHeaders);
          }

          // Check we have at least name columns
          const mappedDbColumns = new Set(Object.values(columnMapping));
          if (
            !mappedDbColumns.has("first_name") &&
            !mappedDbColumns.has("last_name")
          ) {
            setError(
              "Could not find name columns in your CSV. Expected 'First Name' or 'Last Name'."
            );
            return;
          }

          const hasUrlColumn = mappedDbColumns.has("linkedin_url");

          // Map, clean, and validate each row
          const rows = results.data as Record<string, string>[];
          let skipped = 0;
          const connections: ParsedConnection[] = [];

          for (const row of rows) {
            // Map CSV columns → DB columns
            const mapped: Record<string, string> = {};
            for (const [csvHeader, dbColumn] of Object.entries(columnMapping)) {
              mapped[dbColumn] = row[csvHeader] || "";
            }

            // Skip junk rows: all key fields empty
            const hasName =
              (mapped.first_name || "").trim() ||
              (mapped.last_name || "").trim();
            const hasData =
              (mapped.company || "").trim() || (mapped.position || "").trim();
            if (!hasName && !hasData) {
              skipped++;
              continue;
            }

            // Clean LinkedIn URL
            const cleanedUrl = hasUrlColumn
              ? cleanLinkedInUrl(mapped.linkedin_url)
              : null;

            // Skip if URL column exists but URL is invalid
            if (
              hasUrlColumn &&
              (!cleanedUrl || !cleanedUrl.includes("linkedin.com"))
            ) {
              skipped++;
              continue;
            }

            connections.push({
              first_name: (mapped.first_name || "").trim(),
              last_name: (mapped.last_name || "").trim(),
              linkedin_url: cleanedUrl || "",
              email_address: (mapped.email_address || "").trim().toLowerCase(),
              company: (mapped.company || "").trim(),
              position: (mapped.position || "").trim(),
              connected_on: parseLinkedInDate(mapped.connected_on || ""),
            });
          }

          setConnectionCount(connections.length);
          setSkippedCount(skipped);

          if (connections.length === 0) {
            setError("No valid connections found in the CSV.");
            return;
          }

          // Store parsed connections for preview — do NOT upload yet
          setParsedConnections(connections);
        },
        error: () => {
          setParsing(false);
          isProcessingRef.current = false;
          setError("Failed to parse the CSV file. Please check the format.");
        },
      });
    },
    []
  );

  const uploadConnections = useCallback(async () => {
    if (!parsedConnections || parsedConnections.length === 0) return;

    setUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      setUploadProgress(30);

      const res = await fetch("/api/onboarding/csv-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, connections: parsedConnections }),
      });

      setUploadProgress(80);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload connections");
      }

      setUploadProgress(100);
      setUploadComplete(true);
      setParsedConnections(null);
      if (data.mode) setUploadMode(data.mode);
      if (data.tracking_token) setTrackingToken(data.tracking_token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload connections"
      );
    } finally {
      setUploading(false);
    }
  }, [userId, parsedConnections]);

  function handleChangeFile() {
    setParsedConnections(null);
    setConnectionCount(null);
    setSkippedCount(0);
    setFileName(null);
    setError(null);
    isProcessingRef.current = false;
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

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
      parseFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  }

  // Show drop zone when: no parsed data, not uploading, not complete
  const showDropZone = !parsedConnections && !uploadComplete && !parsing && !uploading;
  // Show preview when: parsed data ready, not uploading, not complete
  const showPreview = !!parsedConnections && !uploadComplete && !uploading;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#F5F3FF] animate-scale-in">
          <Upload className="h-7 w-7 text-[#7C3AED]" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
            Upload your connections
          </h1>
          <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
            Upload the Connections.csv file you downloaded from LinkedIn.
          </p>
        </div>
      </div>

      {/* LinkedIn export guide — collapsible */}
      {!uploadComplete && !showPreview && (
        <details className="mt-2 mb-4">
          <summary className="text-sm text-[#635BFF] font-medium cursor-pointer hover:underline">
            How to export your LinkedIn connections
          </summary>
          <div className="mt-2 rounded-lg border border-[#E3E8EF] overflow-hidden">
            <img
              src="/guides/linkedin-export-guide.gif"
              alt="How to export LinkedIn connections"
              className="w-full rounded-lg"
              loading="lazy"
            />
          </div>
        </details>
      )}

      {/* Drag-and-drop zone */}
      {showDropZone && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative rounded-xl border border-dashed p-10 sm:p-14 text-center cursor-pointer
            transition-all duration-300 ease-out group
            ${
              isDragging
                ? "border-[#635BFF] bg-[#EEF2FF] scale-[1.01] shadow-lg shadow-[#635BFF]/10"
                : "border-[#D1D9E6] bg-[#F6F8FA] hover:border-[#635BFF] hover:bg-[#EEF2FF]/50"
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
                flex h-16 w-16 items-center justify-center rounded-xl transition-all duration-300
                ${isDragging ? "bg-[#635BFF]/15 scale-110" : "bg-[#F0F3F7] group-hover:bg-[#635BFF]/10"}
              `}
            >
              <FileSpreadsheet
                className={`h-7 w-7 transition-colors duration-300 ${
                  isDragging
                    ? "text-[#635BFF]"
                    : "text-[#96A0B5] group-hover:text-[#635BFF]"
                }`}
                strokeWidth={1.5}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm sm:text-base font-semibold text-[#0A2540]">
                Drop your Connections.csv here
              </p>
              <p className="text-sm text-[#96A0B5]">
                or{" "}
                <span className="text-[#635BFF] font-medium underline underline-offset-2">
                  click to browse
                </span>
              </p>
            </div>
            <span className="rounded-full bg-[#F0F3F7] px-3 py-1.5 text-xs font-medium text-[#596780]">
              CSV files only
            </span>
          </div>
        </div>
      )}

      {/* Parsing indicator */}
      {parsing && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E3E8EF] border-t-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0A2540]">
                Parsing CSV file...
              </p>
              {fileName && (
                <p className="text-xs text-[#96A0B5] mt-0.5">{fileName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview state — parsed but not yet uploaded */}
      {showPreview && connectionCount !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F3FF]">
              <FileSpreadsheet className="h-6 w-6 text-[#7C3AED]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-base font-semibold text-[#0A2540]">
                {connectionCount.toLocaleString()} connections found
              </p>
              <p className="text-sm text-[#96A0B5]">
                {fileName}
                {skippedCount > 0 &&
                  ` \u2014 ${skippedCount} row${skippedCount > 1 ? "s" : ""} skipped`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleChangeFile}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-sm font-medium text-[#596780] hover:border-[#596780] transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Change File
            </button>
            <Button
              onClick={uploadConnections}
              size="lg"
              className="flex-1 h-[44px] rounded-xl bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all"
            >
              Upload {connectionCount.toLocaleString()} Connections
            </Button>
          </div>
        </div>
      )}

      {/* Uploading progress */}
      {uploading && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E3E8EF] border-t-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0A2540]">
                Uploading {connectionCount?.toLocaleString()} connections...
              </p>
              {fileName && (
                <p className="text-xs text-[#96A0B5] mt-0.5">{fileName}</p>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-[#F0F3F7] overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success state */}
      {uploadComplete && connectionCount !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 space-y-4 animate-scale-in">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 animate-scale-in">
              <CheckCircle
                className="h-8 w-8 text-accent"
                strokeWidth={1.5}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-[#0A2540]">
                {connectionCount.toLocaleString()} connections uploaded
              </p>
              <p className="text-sm text-[#96A0B5]">
                {skippedCount > 0
                  ? `${skippedCount} row${skippedCount > 1 ? "s" : ""} skipped \u2014 missing data`
                  : `Successfully uploaded from ${fileName}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-[#FDE8EC] border border-[#ED5F74]/20 p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="h-5 w-5 text-[#ED5F74] shrink-0 mt-0.5" />
          <p className="text-sm text-[#ED5F74]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="h-[52px] rounded-xl border border-[#E3E8EF] hover:border-[#596780] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {uploadComplete && (
          <Button
            onClick={() => onNext(uploadMode ? { mode: uploadMode, connections: connectionCount || 0, tracking_token: trackingToken || undefined } : undefined)}
            size="lg"
            className="flex-1 h-[52px] rounded-xl bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
