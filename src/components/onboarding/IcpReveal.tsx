"use client";

import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IcpRevealProps {
  userData: Record<string, unknown>;
  onNext: () => void;
  onBack: () => void;
}

export default function IcpReveal({ userData, onNext, onBack }: IcpRevealProps) {
  const fullName = (userData.full_name as string) || "";
  const firstName = fullName.split(" ")[0] || "there";

  const scrapeData = userData.website_scrape_data as
    | Record<string, unknown>
    | undefined;
  const scrapeStatus = userData.website_scrape_status as string | undefined;
  const isLoading = !scrapeData && scrapeStatus === "scraping";

  const customerList = (scrapeData?.customer_list || {}) as Record<
    string,
    unknown
  >;
  const customers = (customerList.customers as string[]) || [];
  const hasCustomers = customers.length > 0;

  if (isLoading) {
    return (
      <div className="animate-fade-in pt-16 pb-10 text-center">
        <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-7 h-7 text-accent animate-spin" />
        </div>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-foreground leading-tight max-w-lg mx-auto">
          Analyzing your website...
        </h1>
        <p className="text-base sm:text-lg text-warm-500 max-w-lg mx-auto leading-relaxed mt-4">
          We&apos;re building a target profile based on your company data.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pt-16 pb-10">
      <div className="text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-7 h-7 text-accent" strokeWidth={1.5} />
        </div>

        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-foreground leading-tight">
          Hey {firstName}, we analyzed your website and found something interesting.
        </h1>

        {hasCustomers ? (
          <p className="text-base sm:text-lg text-warm-500 leading-relaxed mt-5">
            We identified companies like{" "}
            {customers.slice(0, 3).map((name, i, arr) => (
              <span key={name}>
                <span className="font-semibold text-foreground">{name}</span>
                {i < arr.length - 1 ? (i === arr.length - 2 ? ", and " : ", ") : ""}
              </span>
            ))}
            {" "}as potential customers in your network.
          </p>
        ) : (
          <p className="text-base sm:text-lg text-warm-500 leading-relaxed mt-5">
            Based on your website, here&apos;s who we think you should be targeting.
          </p>
        )}

        {hasCustomers && customers.length > 3 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {customers.slice(3, 8).map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full bg-accent-light text-accent px-3.5 py-1.5 text-xs font-semibold border border-accent/10"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10 space-y-4">
          <Button
            onClick={onNext}
            size="lg"
            className="w-full sm:w-auto sm:min-w-[280px] h-12 rounded-xl bg-[#1B4332] text-white font-semibold hover:bg-[#1B4332]/90 active:scale-[0.98] transition-all shadow-sm"
          >
            Review and finalize your ICP
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <div>
            <button
              onClick={onBack}
              className="text-sm font-medium text-warm-500 hover:text-foreground transition-colors py-2"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
