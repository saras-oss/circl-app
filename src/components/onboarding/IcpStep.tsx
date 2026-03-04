"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Plus,
  ArrowLeft,
  Send,
  ChevronUp,
  ChevronDown,
  Target,
  Sparkles,
  MessageSquare,
  Loader2,
  Check,
  Search,
} from "lucide-react";
import {
  INDUSTRY_TAXONOMY,
  COMPANY_HEADCOUNT,
  REVENUE_RANGES,
  FUNDING_STAGES,
  GEOGRAPHIES,
  DEFAULT_TITLES,
} from "@/lib/data/icp-taxonomy";

interface IcpStepProps {
  userId: string;
  userData: Record<string, unknown>;
  onNext: () => void;
  onBack: () => void;
}

interface IcpState {
  industries: string[];
  geographies: string[];
  titles: string[];
  companySizes: string[];
  revenueRanges: string[];
  triggers: string[];
  lookingForInvestors: boolean;
  investorFundTypes: string[];
  investorStages: string[];
  investorSectors: string[];
  lookingForAdvisors: boolean;
  advisorExpertise: string[];
  advisorSeniority: string[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_ICP: IcpState = {
  industries: [],
  geographies: [],
  titles: [],
  companySizes: [],
  revenueRanges: [],
  triggers: [],
  lookingForInvestors: false,
  investorFundTypes: [],
  investorStages: [],
  investorSectors: [],
  lookingForAdvisors: false,
  advisorExpertise: [],
  advisorSeniority: [],
};

const CHAT_SUGGESTION_CHIPS = [
  "Refine my target industries",
  "Find accounts similar to my customers",
  "Help me define ideal company size and stage",
  "What triggers should I look for?",
];

function buildInitialIcp(userData: Record<string, unknown>): IcpState {
  const scrapeData = userData.website_scrape_data as Record<string, unknown> | undefined;
  if (!scrapeData) return { ...DEFAULT_ICP };

  const icpSuggestions = (scrapeData.icp_suggestions || {}) as Record<string, unknown>;
  const salesTriggers = (scrapeData.sales_triggers || {}) as Record<string, unknown>;

  return {
    industries: (icpSuggestions.target_industries as string[]) || (icpSuggestions.industries as string[]) || [],
    geographies: (icpSuggestions.target_geographies as string[]) || (icpSuggestions.geographies as string[]) || [],
    titles: (icpSuggestions.target_titles as string[]) || (icpSuggestions.titles as string[]) || [],
    companySizes: (icpSuggestions.company_sizes as string[]) || (icpSuggestions.companySizes as string[]) || [],
    revenueRanges: (icpSuggestions.revenue_ranges as string[]) || (icpSuggestions.revenueRanges as string[]) || [],
    triggers: (salesTriggers.triggers as string[]) || (icpSuggestions.triggers as string[]) || [],
    lookingForInvestors: false,
    investorFundTypes: [],
    investorStages: [],
    investorSectors: [],
    lookingForAdvisors: false,
    advisorExpertise: [],
    advisorSeniority: [],
  };
}

// Determine which themes are selected based on selected sub-industries
function getSelectedThemes(selectedIndustries: string[]): Set<string> {
  const themes = new Set<string>();
  for (const theme of INDUSTRY_TAXONOMY) {
    if (theme.subIndustries.some((sub) => selectedIndustries.includes(sub))) {
      themes.add(theme.theme);
    }
  }
  return themes;
}

/* ─────────────── Selectable Pill (toggle on/off) ─────────────── */
function TogglePill({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 min-h-[36px] ${
        selected
          ? "bg-accent text-white shadow-sm shadow-accent/20"
          : "bg-warm-50 text-warm-600 border border-warm-200 hover:border-accent/40 hover:text-foreground"
      }`}
    >
      {selected && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

/* ─────────────── Pill Group with freeform add ─────────────── */
function PillGroupEditable({
  label,
  pills,
  onRemove,
  onAdd,
}: {
  label: string;
  pills: string[];
  onRemove: (value: string) => void;
  onAdd: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  function handleAdd() {
    if (newValue.trim()) {
      onAdd(newValue.trim());
      setNewValue("");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">
        {label}
      </h4>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => (
          <span
            key={pill}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium shadow-sm shadow-accent/20"
          >
            {pill}
            <button
              onClick={() => onRemove(pill)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 transition-colors min-w-[22px] min-h-[22px] flex items-center justify-center"
              aria-label={`Remove ${pill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAdding(false); setNewValue(""); }
            }}
            onBlur={() => { if (!newValue.trim()) { setAdding(false); setNewValue(""); } }}
            className="h-9 w-36 rounded-full border-2 border-accent/30 bg-surface px-3 text-xs font-medium text-foreground input-ring focus:outline-none focus:border-accent"
            placeholder="Type and press Enter"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-warm-300 px-3.5 py-1.5 text-xs font-medium text-warm-400 hover:border-accent hover:text-accent transition-colors min-h-[36px]"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Compact Pills Panel (for chat sidebar) ─────────────── */
function CompactPillsPanel({
  icp,
  setIcp,
}: {
  icp: IcpState;
  setIcp: React.Dispatch<React.SetStateAction<IcpState>>;
}) {
  const sections: { key: keyof IcpState; label: string; condition?: (s: IcpState) => boolean }[] = [
    { key: "industries", label: "Industries" },
    { key: "geographies", label: "Geographies" },
    { key: "titles", label: "Titles" },
    { key: "companySizes", label: "Company Size" },
    { key: "revenueRanges", label: "Revenue" },
    { key: "triggers", label: "Triggers" },
    { key: "investorFundTypes", label: "Fund Types", condition: (s) => s.lookingForInvestors },
    { key: "investorStages", label: "Inv. Stage", condition: (s) => s.lookingForInvestors },
    { key: "investorSectors", label: "Sectors", condition: (s) => s.lookingForInvestors },
    { key: "advisorExpertise", label: "Expertise", condition: (s) => s.lookingForAdvisors },
    { key: "advisorSeniority", label: "Seniority", condition: (s) => s.lookingForAdvisors },
  ];

  return (
    <div className="space-y-4">
      {sections.map(({ key, label, condition }) => {
        if (condition && !condition(icp)) return null;
        const pills = icp[key] as string[];
        if (pills.length === 0) return null;
        return (
          <div key={key} className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">{label}</h4>
            <div className="flex flex-wrap gap-1.5">
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2.5 py-1 text-[11px] font-medium"
                >
                  {pill}
                  <button
                    onClick={() => setIcp((prev) => ({ ...prev, [key]: (prev[key] as string[]).filter((v) => v !== pill) }))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20 min-w-[18px] min-h-[18px] flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                         MAIN COMPONENT                        */
/* ═══════════════════════════════════════════════════════════════ */

export default function IcpStep({
  userId,
  userData,
  onNext,
  onBack,
}: IcpStepProps) {
  const [icp, setIcp] = useState<IcpState>(() => buildInitialIcp(userData));
  const [phase, setPhase] = useState<1 | 2>(1);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(() => {
    const scrapeData = userData.website_scrape_data as Record<string, unknown> | undefined;
    const scrapeStatus = userData.website_scrape_status as string | undefined;
    return !scrapeData && scrapeStatus === "scraping";
  });
  const supabase = createClient();

  // Industry search
  const [industrySearch, setIndustrySearch] = useState("");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "No problem! What would you like to change?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [showSuggestionChips, setShowSuggestionChips] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mobilePillsOpen, setMobilePillsOpen] = useState(false);

  // Poll for scrape completion
  useEffect(() => {
    if (!scrapeLoading) return;
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("users")
        .select("website_scrape_data, website_scrape_status")
        .eq("id", userId)
        .single();
      if (data?.website_scrape_data && data.website_scrape_status === "completed") {
        const freshIcp = buildInitialIcp(data as Record<string, unknown>);
        setIcp(freshIcp);
        setScrapeLoading(false);
        clearInterval(interval);
      } else if (data?.website_scrape_status === "failed" || attempts >= maxAttempts) {
        setScrapeLoading(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [scrapeLoading, userId, supabase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const confirmIcp = useCallback(async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/icp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, icpData: icp }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save ICP");
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }, [userId, icp, onNext]);

  async function sendChatMessage(overrideMessage?: string) {
    const userMessage = overrideMessage || chatInput.trim();
    if (!userMessage || chatLoading) return;

    setChatInput("");
    setShowSuggestionChips(false);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/icp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: userMessage,
          currentIcpState: icp,
          sessionId: chatSessionId,
        }),
      });
      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.sessionId && !chatSessionId) setChatSessionId(data.sessionId);
      if (data.icpUpdates) setIcp((prev) => ({ ...prev, ...data.icpUpdates }));
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble processing that. Could you try again?" },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // Toggle helpers
  function toggleIndustry(sub: string) {
    setIcp((prev) => ({
      ...prev,
      industries: prev.industries.includes(sub)
        ? prev.industries.filter((s) => s !== sub)
        : [...prev.industries, sub],
    }));
  }

  function toggleTheme(theme: typeof INDUSTRY_TAXONOMY[number]) {
    const allSelected = theme.subIndustries.every((s) => icp.industries.includes(s));
    setIcp((prev) => ({
      ...prev,
      industries: allSelected
        ? prev.industries.filter((s) => !theme.subIndustries.includes(s))
        : [...new Set([...prev.industries, ...theme.subIndustries])],
    }));
  }

  function toggleItem(key: keyof IcpState, value: string) {
    setIcp((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  const selectedThemes = getSelectedThemes(icp.industries);

  // Filter industry themes by search
  const filteredThemes = industrySearch.trim()
    ? INDUSTRY_TAXONOMY.filter(
        (t) =>
          t.theme.toLowerCase().includes(industrySearch.toLowerCase()) ||
          t.subIndustries.some((s) => s.toLowerCase().includes(industrySearch.toLowerCase()))
      )
    : INDUSTRY_TAXONOMY;

  /* ═══════════════════ PHASE 1: Review ICP ═══════════════════ */
  if (phase === 1) {
    return (
      <div className="animate-fade-in space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
            <Target className="h-7 w-7 text-accent" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Define your Ideal Customer Profile
            </h1>
            <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
              {scrapeLoading
                ? "Analyzing your website to pre-fill suggestions..."
                : "Select who you\u2019re looking to find in your network."}
            </p>
          </div>
        </div>

        {/* Scrape loading indicator */}
        {scrapeLoading && (
          <div className="card-elevated p-5 border-accent/20 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-accent-light rounded-xl flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-bold">Analyzing your website...</p>
                <p className="text-xs text-warm-500 mt-0.5">Pre-filling your ICP based on your company data</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TARGET INDUSTRIES ─── */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            Target Industries
          </h3>

          {/* Industry search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              value={industrySearch}
              onChange={(e) => setIndustrySearch(e.target.value)}
              placeholder="Search industries..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-border bg-surface text-sm input-ring focus:outline-none focus:border-accent"
            />
          </div>

          {/* Theme cards - 2 per row on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredThemes.map((theme) => {
              const isSelected = selectedThemes.has(theme.theme);
              return (
                <button
                  key={theme.theme}
                  onClick={() => toggleTheme(theme)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 min-h-[44px] ${
                    isSelected
                      ? "bg-accent text-white border-accent shadow-md shadow-accent/15"
                      : "bg-surface border-border hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-foreground"}`}>
                      {theme.theme}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${isSelected ? "text-white/70" : "text-warm-400"}`}>
                    {theme.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected sub-industries as pills */}
          {icp.industries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                Selected Sub-Industries
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Show all sub-industries for selected themes as toggleable pills */}
                {INDUSTRY_TAXONOMY.filter((t) => selectedThemes.has(t.theme)).flatMap((t) =>
                  t.subIndustries.map((sub) => (
                    <TogglePill
                      key={sub}
                      label={sub}
                      selected={icp.industries.includes(sub)}
                      onToggle={() => toggleIndustry(sub)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── COMPANY HEADCOUNT ─── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">Company Headcount</h4>
          <div className="flex flex-wrap gap-2">
            {COMPANY_HEADCOUNT.map((size) => (
              <TogglePill key={size} label={size} selected={icp.companySizes.includes(size)} onToggle={() => toggleItem("companySizes", size)} />
            ))}
          </div>
        </div>

        {/* ─── REVENUE RANGE ─── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">Revenue Range</h4>
          <div className="flex flex-wrap gap-2">
            {REVENUE_RANGES.map((rev) => (
              <TogglePill key={rev} label={rev} selected={icp.revenueRanges.includes(rev)} onToggle={() => toggleItem("revenueRanges", rev)} />
            ))}
          </div>
        </div>

        {/* ─── FUNDING STAGE (optional) ─── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">
            Funding Stage <span className="text-warm-300 normal-case">(optional)</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {FUNDING_STAGES.map((stage) => (
              <TogglePill key={stage} label={stage} selected={icp.triggers.includes(stage)} onToggle={() => toggleItem("triggers", stage)} />
            ))}
          </div>
        </div>

        {/* ─── GEOGRAPHY ─── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">Geography</h4>
          <div className="flex flex-wrap gap-2">
            {GEOGRAPHIES.map((geo) => (
              <TogglePill key={geo} label={geo} selected={icp.geographies.includes(geo)} onToggle={() => toggleItem("geographies", geo)} />
            ))}
          </div>
        </div>

        {/* ─── TARGET TITLES ─── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warm-400">Target Titles / Roles</h4>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TITLES.map((title) => (
              <TogglePill key={title} label={title} selected={icp.titles.includes(title)} onToggle={() => toggleItem("titles", title)} />
            ))}
          </div>
          {/* Custom title add */}
          <PillGroupEditable
            label=""
            pills={icp.titles.filter((t) => !DEFAULT_TITLES.includes(t))}
            onRemove={(v) => setIcp((prev) => ({ ...prev, titles: prev.titles.filter((t) => t !== v) }))}
            onAdd={(v) => setIcp((prev) => ({ ...prev, titles: prev.titles.includes(v) ? prev.titles : [...prev.titles, v] }))}
          />
        </div>

        {/* ─── HIGH-INTENT TRIGGERS ─── */}
        <PillGroupEditable
          label="High-Intent Triggers"
          pills={icp.triggers.filter((t) => !FUNDING_STAGES.includes(t))}
          onRemove={(v) => setIcp((prev) => ({ ...prev, triggers: prev.triggers.filter((t) => t !== v) }))}
          onAdd={(v) => setIcp((prev) => ({ ...prev, triggers: prev.triggers.includes(v) ? prev.triggers : [...prev.triggers, v] }))}
        />

        {/* ─── TOGGLES: Investors & Advisors ─── */}
        <div className="card-elevated p-6 space-y-4">
          {/* Investors toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition-colors min-h-[44px]">
            <span className="text-sm font-semibold text-foreground">Looking for Investors?</span>
            <button
              onClick={() => setIcp((prev) => ({ ...prev, lookingForInvestors: !prev.lookingForInvestors }))}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 min-w-[48px] ${icp.lookingForInvestors ? "bg-accent" : "bg-warm-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-200 shadow-sm ${icp.lookingForInvestors ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {icp.lookingForInvestors && (
            <div className="ml-4 space-y-4 border-l-2 border-accent/20 pl-5 animate-fade-in">
              <PillGroupEditable
                label="Fund Types"
                pills={icp.investorFundTypes}
                onRemove={(v) => setIcp((prev) => ({ ...prev, investorFundTypes: prev.investorFundTypes.filter((x) => x !== v) }))}
                onAdd={(v) => setIcp((prev) => ({ ...prev, investorFundTypes: prev.investorFundTypes.includes(v) ? prev.investorFundTypes : [...prev.investorFundTypes, v] }))}
              />
              <PillGroupEditable
                label="Investment Stage"
                pills={icp.investorStages}
                onRemove={(v) => setIcp((prev) => ({ ...prev, investorStages: prev.investorStages.filter((x) => x !== v) }))}
                onAdd={(v) => setIcp((prev) => ({ ...prev, investorStages: prev.investorStages.includes(v) ? prev.investorStages : [...prev.investorStages, v] }))}
              />
              <PillGroupEditable
                label="Sector Focus"
                pills={icp.investorSectors}
                onRemove={(v) => setIcp((prev) => ({ ...prev, investorSectors: prev.investorSectors.filter((x) => x !== v) }))}
                onAdd={(v) => setIcp((prev) => ({ ...prev, investorSectors: prev.investorSectors.includes(v) ? prev.investorSectors : [...prev.investorSectors, v] }))}
              />
            </div>
          )}

          {/* Advisors toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-warm-50 transition-colors min-h-[44px]">
            <span className="text-sm font-semibold text-foreground">Looking for Advisors?</span>
            <button
              onClick={() => setIcp((prev) => ({ ...prev, lookingForAdvisors: !prev.lookingForAdvisors }))}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 min-w-[48px] ${icp.lookingForAdvisors ? "bg-accent" : "bg-warm-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-200 shadow-sm ${icp.lookingForAdvisors ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {icp.lookingForAdvisors && (
            <div className="ml-4 space-y-4 border-l-2 border-accent/20 pl-5 animate-fade-in">
              <PillGroupEditable
                label="Domain Expertise"
                pills={icp.advisorExpertise}
                onRemove={(v) => setIcp((prev) => ({ ...prev, advisorExpertise: prev.advisorExpertise.filter((x) => x !== v) }))}
                onAdd={(v) => setIcp((prev) => ({ ...prev, advisorExpertise: prev.advisorExpertise.includes(v) ? prev.advisorExpertise : [...prev.advisorExpertise, v] }))}
              />
              <PillGroupEditable
                label="Seniority Preference"
                pills={icp.advisorSeniority}
                onRemove={(v) => setIcp((prev) => ({ ...prev, advisorSeniority: prev.advisorSeniority.filter((x) => x !== v) }))}
                onAdd={(v) => setIcp((prev) => ({ ...prev, advisorSeniority: prev.advisorSeniority.includes(v) ? prev.advisorSeniority : [...prev.advisorSeniority, v] }))}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={confirmIcp}
            size="lg"
            loading={confirming}
            className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Yes, this looks right &mdash; find my matches
          </Button>
          <Button
            onClick={() => setPhase(2)}
            variant="outline"
            size="lg"
            className="w-full h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            I want to refine a few things
          </Button>
        </div>

        <Button
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="h-[52px] rounded-2xl min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  /* ═══════════════════ PHASE 2: Chat + Refine ═══════════════════ */

  const chatPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-white shadow-sm shadow-accent/20"
                  : "bg-warm-100 text-foreground shadow-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-warm-100 px-5 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warm-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-warm-400 animate-bounce [animation-delay:0.1s]" />
                <span className="h-2 w-2 rounded-full bg-warm-400 animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion chips */}
      {showSuggestionChips && messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {CHAT_SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => sendChatMessage(chip)}
              className="text-xs px-3.5 py-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-all font-medium"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Chat input */}
      <div className="border-t border-border p-4 bg-warm-50/50">
        <div className="flex gap-3">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
            }}
            placeholder="Tell us what to change..."
            className="h-[52px] rounded-2xl border-2 border-border input-ring"
          />
          <Button
            onClick={() => sendChatMessage()}
            size="lg"
            disabled={!chatInput.trim() || chatLoading}
            className="h-[52px] w-[52px] rounded-2xl bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shrink-0 p-0 transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Refine your ICP
        </h1>
        <p className="text-sm sm:text-base text-warm-500 leading-relaxed">
          Chat with us to adjust your ideal customer profile.
        </p>
      </div>

      {/* Desktop: 65/35 split */}
      <div className="hidden md:flex gap-4 h-[60vh]">
        {/* Chat panel - 65% */}
        <div className="w-[65%] min-w-[500px] card-elevated flex flex-col overflow-hidden">
          {chatPanel}
        </div>

        {/* Pills panel - 35% */}
        <div className="w-[35%] card-elevated flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
              Your ICP
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <CompactPillsPanel icp={icp} setIcp={setIcp} />
          </div>
          <div className="border-t border-border p-4 sticky bottom-0 bg-surface">
            <Button
              onClick={confirmIcp}
              size="lg"
              loading={confirming}
              className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Confirm ICP
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout — chat on top, pills below */}
      <div className="md:hidden space-y-3">
        {/* Chat panel */}
        <div className="card-elevated flex flex-col h-[50vh] overflow-hidden">
          {chatPanel}
        </div>

        {/* Collapsible pills */}
        <div className="card-elevated overflow-hidden">
          <button
            onClick={() => setMobilePillsOpen(!mobilePillsOpen)}
            className="w-full flex items-center justify-between p-4 text-sm font-semibold text-foreground min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span>Your ICP</span>
            </div>
            {mobilePillsOpen ? <ChevronUp className="h-4 w-4 text-warm-400" /> : <ChevronDown className="h-4 w-4 text-warm-400" />}
          </button>
          {mobilePillsOpen && (
            <div className="border-t border-border p-4 animate-fade-in">
              <CompactPillsPanel icp={icp} setIcp={setIcp} />
              <div className="mt-5">
                <Button
                  onClick={confirmIcp}
                  size="lg"
                  loading={confirming}
                  className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
                >
                  Confirm ICP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          onClick={() => setPhase(1)}
          variant="outline"
          size="lg"
          className="h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Button>
      </div>

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="h-[52px] rounded-2xl min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Previous step
      </Button>
    </div>
  );
}
