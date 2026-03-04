"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";

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

const PILL_CATEGORIES: {
  key: keyof IcpState;
  label: string;
  condition?: (icp: IcpState) => boolean;
}[] = [
  { key: "industries", label: "Target Industries" },
  { key: "geographies", label: "Target Geographies" },
  { key: "titles", label: "Target Titles / Roles" },
  { key: "companySizes", label: "Company Size" },
  { key: "revenueRanges", label: "Revenue Ranges" },
  { key: "triggers", label: "Triggers" },
  {
    key: "investorFundTypes",
    label: "Fund Types",
    condition: (icp) => icp.lookingForInvestors,
  },
  {
    key: "investorStages",
    label: "Investment Stage",
    condition: (icp) => icp.lookingForInvestors,
  },
  {
    key: "investorSectors",
    label: "Sector Focus",
    condition: (icp) => icp.lookingForInvestors,
  },
  {
    key: "advisorExpertise",
    label: "Domain Expertise",
    condition: (icp) => icp.lookingForAdvisors,
  },
  {
    key: "advisorSeniority",
    label: "Seniority Preference",
    condition: (icp) => icp.lookingForAdvisors,
  },
];

function buildInitialIcp(userData: Record<string, unknown>): IcpState {
  const scrapeData = userData.website_scrape_data as Record<string, unknown> | undefined;
  if (!scrapeData) return { ...DEFAULT_ICP };

  return {
    industries: (scrapeData.industries as string[]) || [],
    geographies: (scrapeData.geographies as string[]) || [],
    titles: (scrapeData.titles as string[]) || [],
    companySizes: (scrapeData.companySizes as string[]) || [],
    revenueRanges: (scrapeData.revenueRanges as string[]) || [],
    triggers: (scrapeData.triggers as string[]) || [],
    lookingForInvestors: false,
    investorFundTypes: [],
    investorStages: [],
    investorSectors: [],
    lookingForAdvisors: false,
    advisorExpertise: [],
    advisorSeniority: [],
  };
}

function PillGroup({
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
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
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
            className="inline-flex items-center gap-1.5 rounded-full bg-warm-100 px-3 py-1.5 text-xs font-medium text-warm-700 border border-warm-200 transition-colors hover:bg-warm-200/60"
          >
            {pill}
            <button
              onClick={() => onRemove(pill)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-warm-300/50 transition-colors min-w-[22px] min-h-[22px] flex items-center justify-center"
              aria-label={`Remove ${pill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewValue("");
                }
              }}
              className="h-8 w-32 rounded-full border-2 border-accent/30 bg-surface px-3 text-xs font-medium text-foreground input-ring focus:outline-none focus:border-accent"
              placeholder="Add..."
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-warm-300 px-3 py-1.5 text-xs font-medium text-warm-400 hover:border-accent hover:text-accent transition-colors min-h-[32px]"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function PillsPanel({
  icp,
  setIcp,
  compact,
}: {
  icp: IcpState;
  setIcp: React.Dispatch<React.SetStateAction<IcpState>>;
  compact?: boolean;
}) {
  function removePill(key: keyof IcpState, value: string) {
    setIcp((prev) => ({
      ...prev,
      [key]: (prev[key] as string[]).filter((v) => v !== value),
    }));
  }

  function addPill(key: keyof IcpState, value: string) {
    setIcp((prev) => {
      const arr = prev[key] as string[];
      if (arr.includes(value)) return prev;
      return { ...prev, [key]: [...arr, value] };
    });
  }

  return (
    <div className={`space-y-5 ${compact ? "text-sm" : ""}`}>
      {PILL_CATEGORIES.map(({ key, label, condition }) => {
        if (condition && !condition(icp)) return null;
        const pills = icp[key] as string[];
        return (
          <PillGroup
            key={key}
            label={label}
            pills={pills}
            onRemove={(v) => removePill(key, v)}
            onAdd={(v) => addPill(key, v)}
          />
        );
      })}
    </div>
  );
}

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

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "No problem! What would you like to change?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [mobilePillsOpen, setMobilePillsOpen] = useState(false);

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
        body: JSON.stringify({ userId, icp }),
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

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/icp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: userMessage, currentIcp: icp }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      if (data.icpUpdates) {
        setIcp((prev) => ({ ...prev, ...data.icpUpdates }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble processing that. Could you try again?",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

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
              Based on your website and customers, here&apos;s who we think
              you&apos;re looking for.
            </p>
          </div>
        </div>

        {/* Pills card */}
        <div className="card-elevated p-6 sm:p-8 space-y-6">
          <PillsPanel icp={icp} setIcp={setIcp} />

          {/* Toggles section */}
          <div className="space-y-4 border-t border-border pt-6">
            {/* Investors toggle */}
            <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-warm-50 transition-colors min-h-[44px]">
              <span className="text-sm font-semibold text-foreground">
                Looking for Investors?
              </span>
              <button
                onClick={() =>
                  setIcp((prev) => ({
                    ...prev,
                    lookingForInvestors: !prev.lookingForInvestors,
                  }))
                }
                className={`
                  relative h-7 w-12 rounded-full transition-colors duration-200 min-w-[48px]
                  ${icp.lookingForInvestors ? "bg-accent" : "bg-warm-300"}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-200 shadow-sm
                    ${icp.lookingForInvestors ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </label>

            {icp.lookingForInvestors && (
              <div className="ml-4 space-y-4 border-l-2 border-accent/20 pl-5 animate-fade-in">
                <PillGroup
                  label="Fund Types"
                  pills={icp.investorFundTypes}
                  onRemove={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorFundTypes: prev.investorFundTypes.filter(
                        (x) => x !== v
                      ),
                    }))
                  }
                  onAdd={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorFundTypes: prev.investorFundTypes.includes(v)
                        ? prev.investorFundTypes
                        : [...prev.investorFundTypes, v],
                    }))
                  }
                />
                <PillGroup
                  label="Investment Stage"
                  pills={icp.investorStages}
                  onRemove={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorStages: prev.investorStages.filter(
                        (x) => x !== v
                      ),
                    }))
                  }
                  onAdd={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorStages: prev.investorStages.includes(v)
                        ? prev.investorStages
                        : [...prev.investorStages, v],
                    }))
                  }
                />
                <PillGroup
                  label="Sector Focus"
                  pills={icp.investorSectors}
                  onRemove={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorSectors: prev.investorSectors.filter(
                        (x) => x !== v
                      ),
                    }))
                  }
                  onAdd={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      investorSectors: prev.investorSectors.includes(v)
                        ? prev.investorSectors
                        : [...prev.investorSectors, v],
                    }))
                  }
                />
              </div>
            )}

            {/* Advisors toggle */}
            <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-warm-50 transition-colors min-h-[44px]">
              <span className="text-sm font-semibold text-foreground">
                Looking for Advisors?
              </span>
              <button
                onClick={() =>
                  setIcp((prev) => ({
                    ...prev,
                    lookingForAdvisors: !prev.lookingForAdvisors,
                  }))
                }
                className={`
                  relative h-7 w-12 rounded-full transition-colors duration-200 min-w-[48px]
                  ${icp.lookingForAdvisors ? "bg-accent" : "bg-warm-300"}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-200 shadow-sm
                    ${icp.lookingForAdvisors ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </label>

            {icp.lookingForAdvisors && (
              <div className="ml-4 space-y-4 border-l-2 border-accent/20 pl-5 animate-fade-in">
                <PillGroup
                  label="Domain Expertise"
                  pills={icp.advisorExpertise}
                  onRemove={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      advisorExpertise: prev.advisorExpertise.filter(
                        (x) => x !== v
                      ),
                    }))
                  }
                  onAdd={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      advisorExpertise: prev.advisorExpertise.includes(v)
                        ? prev.advisorExpertise
                        : [...prev.advisorExpertise, v],
                    }))
                  }
                />
                <PillGroup
                  label="Seniority Preference"
                  pills={icp.advisorSeniority}
                  onRemove={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      advisorSeniority: prev.advisorSeniority.filter(
                        (x) => x !== v
                      ),
                    }))
                  }
                  onAdd={(v) =>
                    setIcp((prev) => ({
                      ...prev,
                      advisorSeniority: prev.advisorSeniority.includes(v)
                        ? prev.advisorSeniority
                        : [...prev.advisorSeniority, v],
                    }))
                  }
                />
              </div>
            )}
          </div>
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

      {/* Desktop: 70/30 split */}
      <div className="hidden md:flex gap-4 h-[60vh]">
        {/* Chat panel - 70% */}
        <div className="w-[70%] card-elevated flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
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

          {/* Chat input */}
          <div className="border-t border-border p-4 bg-warm-50/50">
            <div className="flex gap-3">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Tell us what to change..."
                className="h-[52px] rounded-2xl border-2 border-border input-ring"
              />
              <Button
                onClick={sendChatMessage}
                size="lg"
                disabled={!chatInput.trim() || chatLoading}
                className="h-[52px] w-[52px] rounded-2xl bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shrink-0 p-0 transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Divider line */}
        <div className="w-px bg-border self-stretch" />

        {/* Pills panel - 30% */}
        <div className="w-[30%] card-elevated flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
              Your ICP
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PillsPanel icp={icp} setIcp={setIcp} compact />
          </div>
          <div className="border-t border-border p-4">
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

      {/* Mobile: Full-width chat + collapsible pills drawer */}
      <div className="md:hidden space-y-3">
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
            {mobilePillsOpen ? (
              <ChevronUp className="h-4 w-4 text-warm-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-warm-400" />
            )}
          </button>
          {mobilePillsOpen && (
            <div className="border-t border-border p-4 animate-fade-in">
              <PillsPanel icp={icp} setIcp={setIcp} compact />
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

        {/* Chat panel */}
        <div className="card-elevated flex flex-col h-[50vh] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

          <div className="border-t border-border p-3 bg-warm-50/50">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Tell us what to change..."
                className="h-[52px] rounded-2xl border-2 border-border input-ring"
              />
              <Button
                onClick={sendChatMessage}
                size="lg"
                disabled={!chatInput.trim() || chatLoading}
                className="h-[52px] w-[52px] rounded-2xl bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shrink-0 p-0 transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
