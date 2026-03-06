"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const typedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsLoggedIn(!!data.user));
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) x.target.classList.add("vis");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".landing .rv").forEach((e) => ro.observe(e));
    return () => ro.disconnect();
  }, []);

  // Score bar animation
  useEffect(() => {
    const bo = new IntersectionObserver(
      (entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) {
            x.target.querySelectorAll<HTMLElement>(".score-fill").forEach((b) => {
              const w = b.style.width;
              b.style.width = "0%";
              setTimeout(() => {
                b.style.width = w;
              }, 80);
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    document.querySelectorAll(".landing .scores").forEach((e) => bo.observe(e));
    return () => bo.disconnect();
  }, []);

  // Typing effect
  useEffect(() => {
    const qs = [
      "Indian CTOs at Series B+ healthcare companies",
      "VCs who invest in fintech at Series A",
      "Who do I know at Stripe?",
      "Founders I've been connected with for 5+ years",
      "Marketing directors at 500+ employee firms",
      "What's my network breakdown by seniority?",
      "Angel investors in Bangalore",
    ];
    let qi = 0,
      ci = 0,
      del = false,
      cancelled = false;
    const el = typedRef.current;
    if (!el) return;

    function tl() {
      if (cancelled) return;
      const q = qs[qi];
      if (!del) {
        el!.textContent = q.substring(0, ci + 1);
        ci++;
        if (ci === q.length) {
          setTimeout(() => {
            del = true;
            tl();
          }, 2400);
          return;
        }
        setTimeout(tl, 35 + Math.random() * 25);
      } else {
        el!.textContent = q.substring(0, ci);
        ci--;
        if (ci < 0) {
          del = false;
          ci = 0;
          qi = (qi + 1) % qs.length;
          setTimeout(tl, 300);
          return;
        }
        setTimeout(tl, 15);
      }
    }
    tl();
    return () => {
      cancelled = true;
    };
  }, []);

  const goLogin = () => router.push("/login");
  const goDashboard = () => router.push("/dashboard");

  // FAQ toggle
  const handleFaqClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const faqI = e.currentTarget.parentElement;
    faqI?.classList.toggle("open");
  };

  // Tabs
  const [activeTab, setActiveTab] = useState("customers");

  return (
    <div className="landing">
      <style>{landingStyles}</style>

      {/* NAV */}
      <nav>
        <div className="nav-c">
          <div className="logo">
            <svg viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9.5" stroke="#e85d26" strokeWidth="1.5" />
              <circle cx="11" cy="11" r="4" fill="#e85d26" />
            </svg>
            Circl
          </div>
          <div className="nav-r">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            {isLoggedIn === null ? null : isLoggedIn ? (
              <button className="btn-s" onClick={goDashboard}>
                Dashboard
              </button>
            ) : (
              <button className="btn-s" onClick={goLogin}>
                Get Started
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="h-badge">
          <span className="dot"></span> Now in early access
        </div>
        <h1>
          Your LinkedIn network is worth more than your CRM.
          <br />
          <span className="hl">You just can&apos;t see it yet.</span>
        </h1>
        <p className="h-sub">
          Circl turns your connections into a scored pipeline of customers and investors — and lets you query your entire network in plain English.
        </p>
        <div className="h-ctas">
          <button className="btn-p" onClick={goLogin}>
            Get Started — $100/yr{" "}
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" />
            </svg>
          </button>
          <button className="btn-g" onClick={goLogin}>
            Try Free — 100 Connections
          </button>
        </div>
        <div className="h-trust">
          <span>
            <svg viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>{" "}
            Results in 15 min
          </span>
          <span className="sep"></span>
          <span>
            <svg viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>{" "}
            We never touch your LinkedIn
          </span>
          <span className="sep"></span>
          <span>
            <svg viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>{" "}
            Your data stays yours
          </span>
        </div>
      </section>

      {/* QUERY CAROUSEL */}
      <div className="qc-wrap">
        <div className="qc-track">
          {[
            "CTOs at Series B+ healthtech companies",
            "Angel investors in Bangalore",
            "Who do I know at Stripe?",
            "VPs of Engineering at 500+ companies",
            "Ex-McKinsey founders in my network",
            "What's my seniority breakdown?",
            "PE partners backing B2B SaaS",
            "Connections in SF I should reconnect with",
            "VCs who invest in fintech at Series A",
            "Senior engineers who recently changed jobs",
            "Directors of Product in fintech",
            "Founders I've known for 5+ years",
          ]
            .concat([
              "CTOs at Series B+ healthtech companies",
              "Angel investors in Bangalore",
              "Who do I know at Stripe?",
              "VPs of Engineering at 500+ companies",
              "Ex-McKinsey founders in my network",
              "What's my seniority breakdown?",
              "PE partners backing B2B SaaS",
              "Connections in SF I should reconnect with",
              "VCs who invest in fintech at Series A",
              "Senior engineers who recently changed jobs",
              "Directors of Product in fintech",
              "Founders I've known for 5+ years",
            ])
            .map((chip, i) => (
              <span key={i} className="qc-chip">
                {chip}
              </span>
            ))}
        </div>
      </div>

      {/* PROBLEM */}
      <section>
        <div className="sc">
          <div className="ctr rv">
            <div className="badge">The Problem</div>
            <h2 className="st">3,000 connections. Zero visibility.</h2>
            <p className="ss">Your next customer, investor, or advisor is already in your network. You just can&apos;t see them.</p>
          </div>
          <div className="prob-grid rv">
            <div className="prob-c">
              <div className="n mono">01</div>
              <h3>Your pipeline is invisible</h3>
              <p>Decision-makers at ICP-fit companies are connected to you right now. You just don&apos;t know which ones.</p>
            </div>
            <div className="prob-c">
              <div className="n mono">02</div>
              <h3>Scrolling doesn&apos;t scale</h3>
              <p>Nobody reviews 5,000 connections to find warm leads. So the pipeline sits there. Untouched.</p>
            </div>
            <div className="prob-c">
              <div className="n mono">03</div>
              <h3>Your CRM is blind</h3>
              <p>It tracks outbound. It has no idea your college roommate runs product at your dream account.</p>
            </div>
          </div>
          <div className="trans rv">
            That&apos;s what <strong>Circl</strong> fixes.
          </div>
        </div>
      </section>

      {/* FEATURE 1: SCORED PIPELINE */}
      <section className="feat" id="features">
        <div className="sc">
          <div className="feat-head rv">
            <div className="badge">Scored Pipeline</div>
            <h2 className="st">
              Upload your connections.
              <br />
              Get a ranked hit list.
            </h2>
            <p className="ss">
              Circl enriches every connection with 30+ data points — work history, company intel, funding, tech stack — then scores each one against your ICP.
            </p>
          </div>
          <div className="feat-visual rv">
            <div className="sp-layout">
              <div className="sp-left">
                <div className="sp-tabs">
                  {(["customers", "investors", "advisors"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`sp-tab${activeTab === tab ? " active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "customers" ? "🎯 Customers" : tab === "investors" ? "💰 Investors" : "🧭 Advisors"}
                    </button>
                  ))}
                </div>

                {activeTab === "customers" && (
                  <div className="sp-content">
                    <h4>Potential Customers</h4>
                    <p>Connections at ICP-fit companies — right industry, size, stage, geography. Every match ranked by decision-maker fit with a plain-English reason.</p>
                    <div className="sp-stats">
                      <div className="sp-stat">
                        <div className="sv mono">30+</div>
                        <div className="sl">Data points per person</div>
                      </div>
                      <div className="sp-stat">
                        <div className="sv mono">10</div>
                        <div className="sl">Pages scraped per company</div>
                      </div>
                      <div className="sp-stat">
                        <div className="sv mono">1–10</div>
                        <div className="sl">Match score precision</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "investors" && (
                  <div className="sp-content">
                    <h4>Potential Investors</h4>
                    <p>VCs, angels, PE partners in your network who invest in your space. Matched by fund type, stage, sector focus, and relationship warmth.</p>
                    <div className="scores">
                      {[
                        { label: "Fund fit", width: "92%", color: "var(--orange)" },
                        { label: "Stage", width: "85%", color: "var(--blue)" },
                        { label: "Sector", width: "78%", color: "var(--green)" },
                        { label: "Seniority", width: "90%", color: "#a78bfa" },
                        { label: "Warmth", width: "70%", color: "var(--orange)" },
                      ].map((s) => (
                        <div key={s.label} className="score-row">
                          <span className="score-lbl">{s.label}</span>
                          <div className="score-track">
                            <div className="score-fill" style={{ width: s.width, background: s.color }}></div>
                          </div>
                          <span className="score-val mono">{(parseFloat(s.width) / 10).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "advisors" && (
                  <div className="sp-content">
                    <h4>Potential Advisors</h4>
                    <p>Senior operators, domain experts, industry veterans. Weighted by domain relevance, seniority, and how long you&apos;ve actually known them.</p>
                    <div style={{ marginTop: 16 }}>
                      {[
                        { label: "Auto-filled from your website", pills: ["Healthtech", "Fintech", "B2B SaaS", "E-commerce"], on: [0, 1, 2] },
                        { label: "Target titles", pills: ["CTO", "VP Eng", "Head of Product", "CEO"], on: [0, 1, 2] },
                        { label: "Geography", pills: ["India", "US", "UK", "SEA"], on: [0, 1] },
                      ].map((g) => (
                        <div key={g.label} className="icp-group">
                          <div className="icp-lbl">{g.label}</div>
                          <div className="icp-pills">
                            {g.pills.map((p, i) => (
                              <span key={p} className={`icp-pill${g.on.includes(i) ? " on" : ""}`}>
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="sp-right">
                <svg className="net-svg" viewBox="0 0 480 420" fill="none">
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <circle cx="15" cy="15" r=".5" fill="rgba(255,255,255,.03)" />
                  </pattern>
                  <rect width="480" height="420" fill="url(#grid)" />
                  <line x1="240" y1="210" x2="90" y2="80" stroke="rgba(232,93,38,.12)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="380" y2="90" stroke="rgba(232,93,38,.12)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="110" y2="310" stroke="rgba(232,93,38,.1)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="370" y2="320" stroke="rgba(232,93,38,.1)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="160" y2="120" stroke="rgba(232,93,38,.08)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="340" y2="350" stroke="rgba(232,93,38,.08)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="60" y2="200" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="420" y2="200" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="200" y2="370" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <line x1="240" y1="210" x2="300" y2="60" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <circle cx="240" cy="210" r="20" fill="rgba(232,93,38,.15)" />
                  <circle cx="240" cy="210" r="12" fill="#e85d26" />
                  <text x="240" y="214" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Inter">YOU</text>
                  <circle cx="90" cy="80" r="14" fill="rgba(232,93,38,.1)" stroke="#e85d26" strokeWidth="1" />
                  <text x="90" y="84" textAnchor="middle" fill="#e85d26" fontSize="8" fontWeight="700" fontFamily="Geist Mono,monospace">9.2</text>
                  <circle cx="380" cy="90" r="13" fill="rgba(232,93,38,.08)" stroke="rgba(232,93,38,.5)" strokeWidth="1" />
                  <text x="380" y="94" textAnchor="middle" fill="#e85d26" fontSize="8" fontWeight="700" fontFamily="Geist Mono,monospace">8.7</text>
                  <circle cx="110" cy="310" r="11" fill="rgba(232,93,38,.07)" stroke="rgba(232,93,38,.4)" strokeWidth="1" />
                  <text x="110" y="314" textAnchor="middle" fill="#e85d26" fontSize="7" fontWeight="700" fontFamily="Geist Mono,monospace">8.4</text>
                  <circle cx="370" cy="320" r="11" fill="rgba(232,93,38,.06)" stroke="rgba(232,93,38,.3)" strokeWidth="1" />
                  <text x="370" y="324" textAnchor="middle" fill="#e85d26" fontSize="7" fontWeight="700" fontFamily="Geist Mono,monospace">7.8</text>
                  <circle cx="160" cy="120" r="9" fill="rgba(232,93,38,.05)" stroke="rgba(232,93,38,.2)" strokeWidth="1" />
                  <text x="160" y="124" textAnchor="middle" fill="#e85d26" fontSize="6" fontWeight="700" fontFamily="Geist Mono,monospace">7.5</text>
                  <circle cx="340" cy="350" r="9" fill="rgba(232,93,38,.05)" stroke="rgba(232,93,38,.2)" strokeWidth="1" />
                  <text x="340" y="354" textAnchor="middle" fill="#e85d26" fontSize="6" fontWeight="700" fontFamily="Geist Mono,monospace">7.2</text>
                  <circle cx="60" cy="200" r="4" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
                  <circle cx="420" cy="200" r="4" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
                  <circle cx="200" cy="370" r="3" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.04)" strokeWidth="1" />
                  <circle cx="300" cy="60" r="3" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.04)" strokeWidth="1" />
                  <circle cx="170" cy="260" r="3" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <circle cx="320" cy="160" r="3" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <circle cx="280" cy="370" r="2.5" fill="rgba(255,255,255,.01)" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                  <circle cx="400" cy="150" r="2.5" fill="rgba(255,255,255,.01)" stroke="rgba(255,255,255,.03)" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: ASK CIRCL */}
      <section className="feat">
        <div className="sc">
          <div className="feat-head rv">
            <div className="badge">Ask Circl</div>
            <h2 className="st">
              Talk to your network
              <br />
              like a database.
            </h2>
            <p className="ss">No filters. No dropdowns. Ask anything in plain English — across person data, company data, and relationship data — and get scored results instantly.</p>
          </div>
          <div className="feat-visual rv">
            <div className="ac-layout">
              <div className="ac-left">
                <div className="qm">
                  <div className="qm-bar">
                    <svg viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <div className="qm-text">
                      <span ref={typedRef}></span>
                      <span className="qm-cursor"></span>
                    </div>
                  </div>
                  <div className="qm-results">
                    {[
                      { initials: "AK", name: "Ankit Khanna", title: "CTO · Healthify · Series C · Bangalore", score: "9.2" },
                      { initials: "PS", name: "Priya Subramaniam", title: "VP Eng · Practo · 800 employees", score: "8.7" },
                      { initials: "RV", name: "Rahul Varma", title: "CTO · MedPrime · Series B · Mumbai", score: "8.4" },
                      { initials: "NM", name: "Neha Mehra", title: "Dir. Eng · CureFit · Bangalore", score: "7.9" },
                    ].map((r) => (
                      <div key={r.initials} className="qr">
                        <div className="qr-av">{r.initials}</div>
                        <div className="qr-info">
                          <div className="qr-name">{r.name}</div>
                          <div className="qr-title">{r.title}</div>
                        </div>
                        <div className="qr-score">{r.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ac-right" style={{ borderLeft: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 6 }}>The queries are endless.</h4>
                <p style={{ fontSize: ".8125rem", color: "var(--gray-1)", marginBottom: 20 }}>Here&apos;s a taste of what you can ask:</p>
                <div className="uc-mini">
                  {[
                    {
                      cat: "Find customers",
                      qs: ["\u201CDecision-makers at companies with 200\u20131,000 employees\u201D", "\u201CPeople at companies that recently raised funding\u201D"],
                    },
                    {
                      cat: "Find warm intros",
                      qs: ["\u201CWho do I know at Stripe?\u201D", "\u201CConnections who previously worked at McKinsey\u201D"],
                    },
                    {
                      cat: "Understand your network",
                      qs: ["\u201CWhat\u2019s my network breakdown by seniority?\u201D", "\u201CHow many connections at 500+ employee companies?\u201D"],
                    },
                  ].map((c, i) => (
                    <div key={c.cat} className="uc-cat" style={i > 0 ? { marginTop: 16 } : undefined}>
                      <div
                        style={{
                          fontFamily: "'Geist Mono',monospace",
                          fontSize: ".625rem",
                          color: "var(--orange)",
                          textTransform: "uppercase" as const,
                          letterSpacing: ".08em",
                          marginBottom: 6,
                          fontWeight: 600,
                        }}
                      >
                        {c.cat}
                      </div>
                      {c.qs.map((q) => (
                        <div key={q} className="uc-q">
                          {q}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* USE CASE GRID */}
          <div className="uc-grid rv">
            {[
              {
                icon: "🎯",
                title: "Find Customers",
                qs: ["\u201CCTOs at Series B+ healthtech in India\u201D", "\u201CDirectors at companies using Salesforce\u201D", "\u201CPeople at ICP companies I haven\u2019t spoken to in 2+ years\u201D"],
              },
              {
                icon: "💰",
                title: "Find Investors",
                qs: ["\u201CVCs investing in B2B SaaS at Series A\u201D", "\u201CAngel investors in Bangalore\u201D", "\u201CInvestors I\u2019ve been connected with for 5+ years\u201D"],
              },
              {
                icon: "🤝",
                title: "Find Warm Intros",
                qs: ["\u201CWho do I know at Stripe?\u201D", "\u201CPeople who moved from consulting to tech\u201D", "\u201CConnections who previously worked at Google\u201D"],
              },
              {
                icon: "🧭",
                title: "Find Advisors",
                qs: ["\u201CEx-founders in logistics with 10+ years exp\u201D", "\u201CC-suite operators I\u2019ve known since before 2020\u201D", "\u201CSenior leaders between roles right now\u201D"],
              },
              {
                icon: "📊",
                title: "Network Intelligence",
                qs: ["\u201CWhat\u2019s my seniority breakdown?\u201D", "\u201CWhich industries are most represented?\u201D", "\u201CHow many VPs or above in my network?\u201D"],
              },
              {
                icon: "📬",
                title: "Prep for Outreach",
                qs: ["\u201CConnections in SF I should reconnect with\u201D", "\u201CMarketing leaders I haven\u2019t talked to in a year\u201D", "\u201CSenior engineers who recently changed jobs\u201D"],
              },
            ].map((card) => (
              <div key={card.title} className="uc-card">
                <h4>
                  {card.icon} {card.title}
                </h4>
                {card.qs.map((q) => (
                  <div key={q} className="uc-q">
                    {q}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="sc">
          <div className="ctr rv">
            <div className="badge">How It Works</div>
            <h2 className="st">Four steps. Fifteen minutes.</h2>
          </div>
          <div className="hw-grid rv">
            {[
              { n: "1", title: "Export from LinkedIn", desc: "Download your connections CSV. We guide you through every click.", time: "~2 min" },
              { n: "2", title: "Confirm your ICP", desc: "We pre-fill your ideal profile from your website. Confirm or refine with AI.", time: "~3 min" },
              { n: "3", title: "We enrich + score", desc: "Deep data on every qualifying connection. AI scores each against your profile.", time: "~15 min (auto)" },
              { n: "4", title: "Search and act", desc: "Scored hit list + plain-English search. Ask anything. Get matches instantly.", time: "\u221E unlimited" },
            ].map((step) => (
              <div key={step.n} className="hw-step">
                <div className="hw-num mono">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <div className="hw-time mono">{step.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="sc">
          <div className="ctr rv">
            <div className="badge">Pricing</div>
            <h2 className="st">One price. Your whole network.</h2>
            <p className="ss">Pay based on network size. Re-query, re-match, re-upload all year.</p>
          </div>
          <div className="pr-grid rv">
            {[
              { name: "Free", conn: "Top 100 connections", amt: "$0", per: "forever", feats: ["100 senior decision-makers", "Full enrichment + scoring", "Query engine on all data", "All 3 discovery modes"], featured: false },
              { name: "Starter", conn: "Up to 1,500", amt: "$100", amtSuffix: "/yr", per: "~$0.07/connection", feats: ["All connections enriched", "Unlimited queries", "Customers + Investors + Advisors", "ICP re-matching anytime"], featured: false },
              { name: "Growth", conn: "Up to 5,000", amt: "$300", amtSuffix: "/yr", per: "~$0.06/connection", feats: ["Everything in Starter", "Priority enrichment", "CSV re-upload as you grow", "WhatsApp notifications"], featured: true, tag: "Most Popular" },
              { name: "Scale", conn: "Up to 10,000", amt: "$500", amtSuffix: "/yr", per: "~$0.05/connection", feats: ["Everything in Growth", "On-demand enrichment", "Extended company scraping", "Priority support"], featured: false },
              { name: "Enterprise", conn: "Up to 25,000", amt: "$700", amtSuffix: "/yr", per: "~$0.03/connection", feats: ["Everything in Scale", "Full deep enrichment", "Dedicated support", "Early access: team features"], featured: false },
            ].map((plan) => (
              <div key={plan.name} className={`pr-card${plan.featured ? " feat-p" : ""}`}>
                {plan.tag && <div className="pr-tag mono">{plan.tag}</div>}
                <div className="pr-name">{plan.name}</div>
                <div className="pr-conn">{plan.conn}</div>
                <div className="pr-amt">
                  {plan.amt} {plan.amtSuffix && <span className="sm">{plan.amtSuffix}</span>}
                </div>
                <div className="pr-per mono">{plan.per}</div>
                <ul className="pr-feats">
                  {plan.feats.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button className="pr-btn" onClick={goLogin}>
                  {plan.name === "Free" ? "Start Free" : "Get Started"}
                </button>
              </div>
            ))}
          </div>
          <p className="pr-note rv">All plans include a full year of access. Cancel anytime. Your data stays yours.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="sc">
          <div className="ctr rv">
            <div className="badge">FAQ</div>
            <h2 className="st">Questions answered</h2>
          </div>
          <div className="faq-list">
            {[
              { q: "Do you connect to my LinkedIn account?", a: "Never. You export your own connections CSV from LinkedIn settings. We never ask for credentials and we never scrape LinkedIn on your behalf." },
              { q: "How does the scoring work?", a: "We enrich every qualifying connection with deep data \u2014 work history, company details, funding, size, tech stack \u2014 then score each one against your ICP using AI. 7+ means it\u2019s worth pursuing. You get a plain-English reason for every score." },
              { q: "What data do you pull?", a: "For each person: full work history, skills, education, activity. For their company: products, market, customers, funding, size, geography, tech stack \u2014 from up to 10 pages of their website." },
              { q: "How is this different from Sales Navigator?", a: "Sales Nav searches all of LinkedIn. Circl only analyzes people you already know \u2014 first-degree connections. Every result is a warm lead, not a cold target. Plus we score for investors and advisors, not just customers." },
              { q: "What happens after the free tier?", a: "Free fully enriches your top 100 senior connections with scores, reasons, and data. Want the rest? Upgrade starts at $100/year." },
              { q: "Can I re-run if my ICP changes?", a: "Yes. Update your ICP and re-run matching at no extra cost during your subscription year. You can also re-upload your CSV as your network grows." },
            ].map((faq) => (
              <div key={faq.q} className="faq-i rv">
                <div className="faq-q" onClick={handleFaqClick}>
                  {faq.q}
                  <span className="faq-t">+</span>
                </div>
                <div className="faq-a">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="rv">
          <h2>
            Stop scrolling.
            <br />
            Start <span className="hl">closing.</span>
          </h2>
          <p>Your next customer, investor, or advisor is already connected to you.</p>
          <div className="h-ctas" style={{ justifyContent: "center" }}>
            <button className="btn-p" onClick={goLogin}>
              Get Started — $100/yr{" "}
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" />
              </svg>
            </button>
            <button className="btn-g" onClick={goLogin}>
              Try 100 Connections Free
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="f-logo">
          Circl<span style={{ color: "var(--orange)" }}>.</span>
        </div>
        <div>&copy; 2026 Circl. All rights reserved.</div>
      </footer>
    </div>
  );
}

const landingStyles = `
.landing {
  --bg:#000;
  --surface:#0a0a0a;
  --surface-2:#111;
  --surface-3:#171717;
  --border:rgba(255,255,255,.08);
  --border-h:rgba(255,255,255,.14);
  --white:#ededed;
  --gray-1:#a0a0a0;
  --gray-2:#666;
  --gray-3:#444;
  --accent:#fff;
  --orange:#e85d26;
  --orange-soft:rgba(232,93,38,.08);
  --orange-glow:rgba(232,93,38,.12);
  --green:#00d47b;
  --blue:#4d90fe;
  --r:12px;
  --r-lg:16px;
  margin:0;padding:0;box-sizing:border-box;
  font-family:'Inter',system-ui,-apple-system,sans-serif;
  background:var(--bg);color:var(--white);
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;line-height:1.6;
  min-height:100vh;
}
.landing *{box-sizing:border-box;margin:0;padding:0}
.landing a{color:inherit;text-decoration:none}
.landing button{font-family:inherit;cursor:pointer}
.landing .mono{font-family:'Geist Mono',monospace}

.landing nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  padding:0 24px;height:56px;
  display:flex;align-items:center;
  backdrop-filter:blur(16px) saturate(180%);
  background:rgba(0,0,0,.6);
  border-bottom:1px solid var(--border);
}
.landing .nav-c{
  max-width:1120px;width:100%;margin:0 auto;
  display:flex;align-items:center;justify-content:space-between;
}
.landing .logo{
  font-weight:700;font-size:1.1rem;letter-spacing:-.03em;
  display:flex;align-items:center;gap:7px;
}
.landing .logo svg{width:22px;height:22px}
.landing .nav-r{display:flex;align-items:center;gap:28px;font-size:.875rem}
.landing .nav-r a{color:var(--gray-1);transition:color .15s;font-weight:500}
.landing .nav-r a:hover{color:var(--white)}
.landing .btn-s{
  background:#fff;color:#000;
  padding:7px 16px;border-radius:8px;
  font-weight:600;font-size:.8125rem;border:none;
  transition:all .2s;
}
.landing .btn-s:hover{opacity:.85}

.landing .hero{
  padding:140px 24px 80px;
  max-width:1120px;margin:0 auto;
  text-align:center;position:relative;
}
.landing .hero::before{
  content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);
  width:600px;height:600px;
  background:radial-gradient(circle,var(--orange-glow) 0%,transparent 60%);
  pointer-events:none;opacity:.5;
}
.landing .h-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 14px;border-radius:100px;
  border:1px solid var(--border);
  font-size:.75rem;font-weight:500;color:var(--gray-1);
  margin-bottom:32px;
  animation:landing-fu .5s ease both;
}
.landing .h-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}
.landing h1{
  font-size:clamp(2.5rem,6vw,4.25rem);
  font-weight:800;line-height:1.08;letter-spacing:-.045em;
  max-width:720px;margin:0 auto;
  animation:landing-fu .5s .05s ease both;
}
.landing h1 .hl{color:var(--orange)}
.landing .h-sub{
  font-size:clamp(1rem,1.3vw,1.15rem);
  color:var(--gray-1);max-width:520px;
  margin:20px auto 0;font-weight:400;
  line-height:1.65;letter-spacing:-.01em;
  animation:landing-fu .5s .1s ease both;
}
.landing .h-ctas{
  display:flex;gap:12px;justify-content:center;
  margin-top:36px;animation:landing-fu .5s .15s ease both;
}
.landing .btn-p{
  background:var(--orange);color:#fff;
  padding:12px 28px;border-radius:10px;
  font-weight:600;font-size:.9rem;border:none;
  transition:all .2s;display:inline-flex;align-items:center;gap:6px;
}
.landing .btn-p:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 8px 24px rgba(232,93,38,.25)}
.landing .btn-p svg{width:14px;height:14px}
.landing .btn-g{
  background:transparent;color:var(--white);
  padding:12px 28px;border-radius:10px;
  font-weight:600;font-size:.9rem;
  border:1px solid var(--border);transition:all .2s;
}
.landing .btn-g:hover{border-color:var(--border-h);background:var(--surface)}
.landing .h-trust{
  display:flex;align-items:center;justify-content:center;gap:20px;
  margin-top:48px;font-size:.8rem;color:var(--gray-2);
  animation:landing-fu .5s .2s ease both;
}
.landing .h-trust span{display:flex;align-items:center;gap:5px}
.landing .h-trust svg{width:14px;height:14px;stroke:var(--gray-2);fill:none;stroke-width:2}
.landing .h-trust .sep{width:3px;height:3px;border-radius:50%;background:var(--gray-3)}
@keyframes landing-fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

.landing section{padding:100px 24px}
.landing .sc{max-width:1120px;margin:0 auto}
.landing .badge{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
  color:var(--orange);padding:5px 12px;border-radius:100px;
  background:var(--orange-soft);border:1px solid rgba(232,93,38,.12);
  display:inline-block;margin-bottom:16px;
}
.landing .st{font-size:clamp(1.8rem,3.2vw,2.5rem);font-weight:800;line-height:1.12;letter-spacing:-.035em}
.landing .ss{font-size:1rem;color:var(--gray-1);margin-top:12px;max-width:480px;letter-spacing:-.01em}
.landing .ctr{text-align:center}
.landing .ctr .ss{margin-left:auto;margin-right:auto}

.landing .prob-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:1px;
  background:var(--border);border-radius:var(--r-lg);
  overflow:hidden;margin-top:48px;
}
.landing .prob-c{
  background:var(--surface);padding:36px 28px;
  transition:background .3s;
}
.landing .prob-c:hover{background:var(--surface-2)}
.landing .prob-c .n{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;color:var(--orange);margin-bottom:16px;font-weight:600;
}
.landing .prob-c h3{font-size:1.05rem;font-weight:700;margin-bottom:8px;letter-spacing:-.02em}
.landing .prob-c p{font-size:.875rem;color:var(--gray-1);line-height:1.6}
.landing .trans{
  text-align:center;padding:40px 24px 0;
  font-size:1.1rem;font-weight:600;color:var(--gray-2);letter-spacing:-.01em;
}
.landing .trans strong{color:var(--white)}

.landing .feat{border-top:1px solid var(--border)}
.landing .feat-head{margin-bottom:48px}
.landing .feat-visual{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);overflow:hidden;position:relative;
  min-height:420px;
}

.landing .sp-layout{display:grid;grid-template-columns:1fr 1fr;min-height:420px}
.landing .sp-left{padding:40px 36px;display:flex;flex-direction:column;justify-content:center}
.landing .sp-tabs{display:flex;gap:8px;margin-bottom:24px}
.landing .sp-tab{
  padding:8px 16px;border-radius:8px;
  font-size:.8125rem;font-weight:600;
  background:var(--surface-2);border:1px solid var(--border);
  color:var(--gray-1);cursor:pointer;transition:all .2s;
}
.landing .sp-tab.active{background:var(--orange-soft);border-color:rgba(232,93,38,.2);color:var(--orange)}
.landing .sp-content h4{font-size:1.1rem;font-weight:700;margin-bottom:6px;letter-spacing:-.02em}
.landing .sp-content p{font-size:.875rem;color:var(--gray-1);line-height:1.6;margin-bottom:20px}
.landing .sp-stats{display:flex;gap:24px}
.landing .sp-stat .sv{
  font-family:'Geist Mono',monospace;
  font-size:1.4rem;font-weight:700;color:var(--orange);
}
.landing .sp-stat .sl{font-size:.72rem;color:var(--gray-2);margin-top:2px}

.landing .sp-right{
  border-left:1px solid var(--border);
  position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;
  background:var(--surface-2);
}

.landing .net-svg{width:100%;height:100%;min-height:420px}

.landing .scores{padding:20px 0}
.landing .score-row{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.landing .score-row:last-child{margin:0}
.landing .score-lbl{font-size:.75rem;font-weight:600;width:72px;text-align:right;color:var(--gray-1);flex-shrink:0}
.landing .score-track{flex:1;height:6px;background:var(--surface-3);border-radius:100px;overflow:hidden}
.landing .score-fill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.23,1,.32,1)}
.landing .score-val{font-family:'Geist Mono',monospace;font-size:.72rem;font-weight:600;width:24px;color:var(--gray-1)}

.landing .icp-group{margin-bottom:16px}
.landing .icp-group:last-child{margin:0}
.landing .icp-lbl{
  font-family:'Geist Mono',monospace;
  font-size:.625rem;font-weight:500;color:var(--gray-2);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;
}
.landing .icp-pills{display:flex;flex-wrap:wrap;gap:6px}
.landing .icp-pill{
  padding:5px 12px;border-radius:100px;
  font-size:.72rem;font-weight:600;
  border:1px solid var(--border);background:var(--surface-3);color:var(--gray-1);
}
.landing .icp-pill.on{background:var(--orange-soft);border-color:rgba(232,93,38,.2);color:var(--orange)}

.landing .ac-layout{display:grid;grid-template-columns:1fr 1fr;min-height:480px}
.landing .ac-left{padding:40px 36px;display:flex;flex-direction:column;justify-content:center}
.landing .ac-right{
  background:var(--surface-2);padding:24px;
  display:flex;flex-direction:column;justify-content:center;
}

.landing .qm{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.landing .qm-bar{
  display:flex;align-items:center;gap:10px;
  padding:14px 16px;border-bottom:1px solid var(--border);
}
.landing .qm-bar svg{width:16px;height:16px;stroke:var(--gray-2);fill:none;stroke-width:2;flex-shrink:0}
.landing .qm-text{font-size:.875rem;color:var(--white)}
.landing .qm-cursor{
  display:inline-block;width:1.5px;height:1em;background:var(--orange);
  margin-left:1px;animation:landing-blink 1s infinite;vertical-align:middle;
}
@keyframes landing-blink{0%,50%{opacity:1}51%,100%{opacity:0}}
.landing .qm-results{padding:8px 16px}
.landing .qr{
  display:flex;align-items:center;gap:10px;
  padding:10px 0;border-bottom:1px solid var(--border);
}
.landing .qr:last-child{border:none}
.landing .qr-av{
  width:32px;height:32px;border-radius:8px;
  background:var(--surface-3);display:flex;align-items:center;justify-content:center;
  font-size:.65rem;font-weight:700;color:var(--gray-2);flex-shrink:0;
}
.landing .qr-info{flex:1}
.landing .qr-name{font-weight:600;font-size:.8125rem}
.landing .qr-title{font-size:.7rem;color:var(--gray-2);margin-top:1px}
.landing .qr-score{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;font-weight:600;
  padding:3px 8px;border-radius:6px;
  background:var(--orange-soft);color:var(--orange);
}

.landing .uc-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:36px;
}
.landing .uc-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r);padding:24px 20px;
  transition:all .25s;cursor:default;
}
.landing .uc-card:hover{border-color:var(--border-h);transform:translateY(-2px)}
.landing .uc-card h4{font-size:.9rem;font-weight:700;margin-bottom:10px;letter-spacing:-.01em}
.landing .uc-q{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;color:var(--gray-1);
  padding:6px 0;border-bottom:1px solid var(--border);
  line-height:1.5;
}
.landing .uc-q:last-child{border:none}

.landing .qc-wrap{overflow:hidden;position:relative;padding:0 0 40px}
.landing .qc-wrap::before,.landing .qc-wrap::after{
  content:'';position:absolute;top:0;bottom:0;width:80px;z-index:2;
}
.landing .qc-wrap::before{left:0;background:linear-gradient(90deg,var(--bg),transparent)}
.landing .qc-wrap::after{right:0;background:linear-gradient(-90deg,var(--bg),transparent)}
.landing .qc-track{display:flex;gap:10px;animation:landing-qcScroll 40s linear infinite;width:max-content}
.landing .qc-chip{
  padding:8px 16px;border-radius:8px;
  background:var(--surface);border:1px solid var(--border);
  font-family:'Geist Mono',monospace;font-size:.72rem;font-weight:500;
  color:var(--gray-1);white-space:nowrap;
  transition:all .2s;
}
.landing .qc-chip:hover{border-color:var(--orange);color:var(--orange)}
@keyframes landing-qcScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

.landing .hw-grid{
  display:grid;grid-template-columns:repeat(4,1fr);gap:1px;
  background:var(--border);border-radius:var(--r-lg);
  overflow:hidden;margin-top:48px;
}
.landing .hw-step{
  background:var(--surface);padding:36px 24px;text-align:center;
  transition:background .3s;position:relative;
}
.landing .hw-step:hover{background:var(--surface-2)}
.landing .hw-num{
  width:40px;height:40px;border-radius:50%;
  border:1px solid rgba(232,93,38,.2);background:var(--orange-soft);
  display:flex;align-items:center;justify-content:center;
  font-family:'Geist Mono',monospace;font-size:.8125rem;font-weight:600;
  color:var(--orange);margin:0 auto 20px;
}
.landing .hw-step h3{font-size:.95rem;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
.landing .hw-step p{font-size:.8125rem;color:var(--gray-1);line-height:1.55}
.landing .hw-time{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;color:var(--orange);margin-top:12px;opacity:.6;
}

.landing .pr-grid{
  display:grid;grid-template-columns:repeat(5,1fr);gap:1px;
  background:var(--border);border-radius:var(--r-lg);
  overflow:hidden;margin-top:48px;
}
.landing .pr-card{
  background:var(--surface);padding:32px 20px;text-align:center;
  display:flex;flex-direction:column;transition:background .3s;
}
.landing .pr-card:hover{background:var(--surface-2)}
.landing .pr-card.feat-p{background:linear-gradient(180deg,rgba(232,93,38,.04) 0%,var(--surface) 50%)}
.landing .pr-tag{
  font-family:'Geist Mono',monospace;
  font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--orange);margin-bottom:4px;font-weight:600;
}
.landing .pr-name{font-size:1rem;font-weight:700;margin-bottom:2px}
.landing .pr-conn{font-size:.72rem;color:var(--gray-2);margin-bottom:20px}
.landing .pr-amt{font-size:2.2rem;font-weight:800;letter-spacing:-.04em;line-height:1}
.landing .pr-amt .sm{font-size:.8125rem;font-weight:500;color:var(--gray-2)}
.landing .pr-per{font-size:.6875rem;color:var(--gray-2);margin-top:4px;margin-bottom:24px}
.landing .pr-feats{
  list-style:none;text-align:left;font-size:.75rem;color:var(--gray-1);
  display:flex;flex-direction:column;gap:7px;flex:1;
  padding:0;margin:0;
}
.landing .pr-feats li{display:flex;align-items:flex-start;gap:6px}
.landing .pr-feats li::before{content:'\\2713';color:var(--orange);font-weight:700;font-size:.7rem;flex-shrink:0;margin-top:1px}
.landing .pr-btn{
  margin-top:20px;width:100%;padding:10px 0;border-radius:8px;
  font-size:.8125rem;font-weight:600;transition:all .2s;
  border:1px solid var(--border);background:transparent;color:var(--white);
}
.landing .pr-btn:hover{border-color:var(--orange);color:var(--orange)}
.landing .pr-card.feat-p .pr-btn{background:var(--orange);border-color:var(--orange);color:#fff}
.landing .pr-card.feat-p .pr-btn:hover{filter:brightness(1.1)}
.landing .pr-note{text-align:center;margin-top:28px;font-size:.8125rem;color:var(--gray-2)}

.landing .faq-list{max-width:640px;margin:48px auto 0}
.landing .faq-i{border-bottom:1px solid var(--border);padding:20px 0}
.landing .faq-q{
  font-size:.95rem;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  letter-spacing:-.01em;
}
.landing .faq-t{
  width:24px;height:24px;border-radius:6px;
  background:var(--surface-2);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  color:var(--gray-1);font-size:.9rem;font-weight:300;flex-shrink:0;
  transition:all .25s;
}
.landing .faq-i.open .faq-t{transform:rotate(45deg);color:var(--orange);background:var(--orange-soft);border-color:rgba(232,93,38,.15)}
.landing .faq-a{
  max-height:0;overflow:hidden;
  transition:max-height .35s ease,padding .35s ease;
  font-size:.875rem;line-height:1.7;color:var(--gray-1);
}
.landing .faq-i.open .faq-a{max-height:220px;padding-top:12px}

.landing .cta-final{
  padding:120px 24px;text-align:center;position:relative;
  border-top:1px solid var(--border);
}
.landing .cta-final::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:500px;height:500px;
  background:radial-gradient(circle,var(--orange-glow) 0%,transparent 60%);
  pointer-events:none;opacity:.5;
}
.landing .cta-final h2{
  font-size:clamp(2.2rem,4.5vw,3.4rem);font-weight:800;
  letter-spacing:-.04em;line-height:1.1;max-width:520px;margin:0 auto 14px;
}
.landing .cta-final h2 .hl{color:var(--orange)}
.landing .cta-final p{color:var(--gray-1);font-size:1rem;margin-bottom:32px}

.landing footer{
  border-top:1px solid var(--border);padding:32px 24px;
  max-width:1120px;margin:0 auto;
  display:flex;align-items:center;justify-content:space-between;
  font-size:.75rem;color:var(--gray-2);
}
.landing .f-logo{font-weight:700;font-size:1rem;color:var(--white)}

.landing .rv{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}
.landing .rv.vis{opacity:1;transform:translateY(0)}

@media(max-width:900px){
  .landing .sp-layout,.landing .ac-layout{grid-template-columns:1fr}
  .landing .sp-right,.landing .ac-right{border-left:none;border-top:1px solid var(--border)}
  .landing .pr-grid{grid-template-columns:repeat(2,1fr)}
  .landing .uc-grid{grid-template-columns:1fr}
}
@media(max-width:768px){
  .landing .nav-r a:not(.btn-s){display:none}
  .landing .prob-grid,.landing .hw-grid{grid-template-columns:1fr}
  .landing .pr-grid{grid-template-columns:1fr}
  .landing .h-ctas{flex-direction:column;align-items:center}
  .landing .h-trust{flex-wrap:wrap;justify-content:center}
  .landing .sp-stats{flex-wrap:wrap}
}
`;
