"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const [activeTab, setActiveTab] = useState("customers");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const searchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const catIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Typing effect + profile panel swap
  useEffect(() => {
    const searchQueries = [
      {
        q: "Indian CTOs at Series B+ healthcare companies",
        results: [
          { av: "AK", name: "Ankit Khanna", title: "CTO \u00b7 Healthify \u00b7 Series C \u00b7 Bangalore", score: "9.2" },
          { av: "PS", name: "Priya Subramaniam", title: "VP Eng \u00b7 Practo \u00b7 800 employees", score: "8.7" },
          { av: "RV", name: "Rahul Varma", title: "CTO \u00b7 MedPrime \u00b7 Series B \u00b7 Mumbai", score: "8.4" },
          { av: "NM", name: "Neha Mehra", title: "Dir. Eng \u00b7 CureFit \u00b7 Bangalore", score: "7.9" },
        ],
        profile: {
          av: "AK", name: "Ankit Khanna", role: "CTO \u00b7 Healthify \u00b7 Bangalore", score: "9.2",
          connected: 'Connected since <strong>2019</strong> \u2014 6 years',
          reason: "Series C healthtech company, 800 employees. Perfect ICP match on industry, company size, and title. CTO-level decision-maker with budget authority. Warm relationship \u2014 connected 6 years.",
          facts: ["Healthtech", "Series C", "800 emp", "CTO", "Bangalore"],
          company: ["Health & Wellness", "$45M raised", "React + Node stack"],
        },
      },
      {
        q: "VCs who invest in fintech at Series A",
        results: [
          { av: "RM", name: "Ravi Mehta", title: "Partner \u00b7 Sequoia India \u00b7 Series A\u2013B", score: "8.9" },
          { av: "SN", name: "Sanjay Nair", title: "GP \u00b7 Accel \u00b7 Seed to A", score: "8.3" },
          { av: "LC", name: "Lisa Chen", title: "Angel \u00b7 Healthtech & Fintech", score: "7.6" },
          { av: "DP", name: "David Park", title: "MD \u00b7 Tiger Global \u00b7 Growth", score: "7.2" },
        ],
        profile: {
          av: "RM", name: "Ravi Mehta", role: "Partner \u00b7 Sequoia India", score: "8.9",
          connected: 'Connected since <strong>2017</strong> \u2014 8 years',
          reason: "Partner at Sequoia India, investing in Series A\u2013B fintech and SaaS. Direct decision-maker at top-tier fund. Long relationship \u2014 connected 8 years. Fund thesis aligns with your space.",
          facts: ["Sequoia India", "Series A\u2013B", "Fintech", "Partner"],
          company: ["$2.8B AUM", "India & SEA focus", "45 active portfolio cos"],
        },
      },
      {
        q: "Who do I know at Stripe?",
        results: [
          { av: "MJ", name: "Maya Joshi", title: "Sr. PM \u00b7 Stripe \u00b7 San Francisco", score: "8.1" },
          { av: "TW", name: "Tom Williams", title: "Eng Lead \u00b7 Stripe \u00b7 Dublin", score: "7.4" },
          { av: "AR", name: "Aisha Rahman", title: "BD \u00b7 Stripe \u00b7 Singapore", score: "7.1" },
        ],
        profile: {
          av: "MJ", name: "Maya Joshi", role: "Sr. PM \u00b7 Stripe \u00b7 San Francisco", score: "8.1",
          connected: 'Connected since <strong>2020</strong> \u2014 5 years',
          reason: "Senior Product Manager at Stripe, 3 years. Previously at Razorpay \u2014 strong fintech background. Warm connection through fintech community events. Decision-adjacent role with internal influence.",
          facts: ["Stripe", "Sr. PM", "San Francisco", "Ex-Razorpay"],
          company: ["Payments infra", "10,000+ emp", "$95B valuation"],
        },
      },
    ];

    let sqIdx = 0, ci = 0, deleting = false, cancelled = false;
    const el = typedRef.current;
    if (!el) return;

    const resultsEl = document.getElementById("search-results");
    const profileEl = document.getElementById("ac-profile");
    if (!resultsEl || !profileEl) return;

    function renderResults(results: typeof searchQueries[0]["results"]) {
      const rows = resultsEl!.querySelectorAll<HTMLElement>(".qr");
      rows.forEach((r, i) => {
        if (results[i]) {
          r.querySelector(".qr-av")!.textContent = results[i].av;
          r.querySelector(".qr-name")!.textContent = results[i].name;
          r.querySelector(".qr-title")!.textContent = results[i].title;
          r.querySelector(".qr-score")!.textContent = results[i].score;
          r.style.display = "flex";
          r.style.opacity = "0";
          r.style.transform = "translateY(8px)";
          const t = setTimeout(() => {
            r.style.transition = "all .3s";
            r.style.opacity = "1";
            r.style.transform = "translateY(0)";
          }, 100 + i * 80);
          searchTimers.current.push(t);
        } else {
          r.style.display = "none";
        }
      });
    }

    function updateProfile(p: typeof searchQueries[0]["profile"]) {
      profileEl!.style.opacity = "0";
      profileEl!.style.transform = "translateY(6px)";
      const t = setTimeout(() => {
        document.getElementById("pp-av")!.textContent = p.av;
        document.getElementById("pp-name")!.textContent = p.name;
        document.getElementById("pp-role")!.textContent = p.role;
        document.getElementById("pp-score")!.textContent = p.score;
        document.getElementById("pp-connected")!.innerHTML =
          '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:var(--green);fill:none;stroke-width:2;vertical-align:middle;margin-right:4px"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span>' + p.connected + "</span>";
        document.getElementById("pp-reason")!.textContent = p.reason;
        document.getElementById("pp-facts")!.innerHTML = p.facts.map((f) => '<span class="pp-fact">' + f + "</span>").join("");
        document.getElementById("pp-company")!.innerHTML = p.company.map((f) => '<span class="pp-fact">' + f + "</span>").join("");
        profileEl!.style.transition = "all .4s cubic-bezier(.23,1,.32,1)";
        profileEl!.style.opacity = "1";
        profileEl!.style.transform = "translateY(0)";
      }, 200);
      searchTimers.current.push(t);
    }

    function typeLoop() {
      if (cancelled) return;
      const sq = searchQueries[sqIdx];
      const q = sq.q;
      if (!deleting) {
        el!.textContent = q.substring(0, ci + 1);
        ci++;
        if (ci === q.length) {
          const t1 = setTimeout(() => { renderResults(sq.results); }, 300);
          const t2 = setTimeout(() => { updateProfile(sq.profile); }, 1400);
          const t3 = setTimeout(() => { deleting = true; typeLoop(); }, 6000);
          searchTimers.current.push(t1, t2, t3);
          return;
        }
        const t = setTimeout(typeLoop, 35 + Math.random() * 20);
        searchTimers.current.push(t);
      } else {
        el!.textContent = q.substring(0, ci);
        ci--;
        if (ci < 0) {
          deleting = false;
          ci = 0;
          sqIdx = (sqIdx + 1) % searchQueries.length;
          resultsEl!.querySelectorAll<HTMLElement>(".qr").forEach((r) => {
            r.style.opacity = "0";
            r.style.transform = "translateY(8px)";
          });
          const t = setTimeout(typeLoop, 400);
          searchTimers.current.push(t);
          return;
        }
        const t = setTimeout(typeLoop, 12);
        searchTimers.current.push(t);
      }
    }
    typeLoop();

    return () => {
      cancelled = true;
      searchTimers.current.forEach((t) => clearTimeout(t));
      searchTimers.current = [];
    };
  }, []);

  // Query category auto-rotation
  const qeData: Record<string, string[]> = {
    Customers: [
      "\u201CCTOs at Series B+ healthtech in India\u201D",
      "\u201CDecision-makers at companies with 200\u20131,000 employees\u201D",
      "\u201CPeople at companies that recently raised funding\u201D",
    ],
    Investors: [
      "\u201CVCs investing in B2B SaaS at Series A\u201D",
      "\u201CAngel investors in Bangalore\u201D",
      "\u201CInvestors I\u2019ve been connected with for 5+ years\u201D",
    ],
    "Warm Intros": [
      "\u201CWho do I know at Stripe?\u201D",
      "\u201CConnections who previously worked at McKinsey\u201D",
      "\u201CPeople who moved from consulting to tech\u201D",
    ],
    Advisors: [
      "\u201CEx-founders in logistics with 10+ years exp\u201D",
      "\u201CC-suite operators I\u2019ve known since before 2020\u201D",
      "\u201CSenior leaders between roles right now\u201D",
    ],
    Intelligence: [
      "\u201CWhat\u2019s my seniority breakdown?\u201D",
      "\u201CWhich industries are most represented?\u201D",
      "\u201CHow many VPs or above in my network?\u201D",
    ],
    Outreach: [
      "\u201CConnections in SF I should reconnect with\u201D",
      "\u201CMarketing leaders I haven\u2019t talked to in a year\u201D",
      "\u201CSenior engineers who recently changed jobs\u201D",
    ],
  };
  const qeCats = Object.keys(qeData);

  useEffect(() => {
    catIntervalRef.current = setInterval(() => {
      setActiveCatIdx((prev) => (prev + 1) % qeCats.length);
    }, 5000);
    return () => {
      if (catIntervalRef.current) clearInterval(catIntervalRef.current);
    };
  }, [qeCats.length]);

  const handleCatClick = (idx: number) => {
    setActiveCatIdx(idx);
    if (catIntervalRef.current) clearInterval(catIntervalRef.current);
    catIntervalRef.current = setInterval(() => {
      setActiveCatIdx((prev) => (prev + 1) % qeCats.length);
    }, 5000);
  };

  const goLogin = () => router.push("/login");
  const goDashboard = () => router.push("/dashboard");

  const faqItems = [
    {
      q: "How is this different from LinkedIn Sales Navigator?",
      a: "Sales Navigator lets you search across all of LinkedIn \u2014 but it\u2019s limited to LinkedIn\u2019s own data, which means self-reported titles and often outdated profiles. It can\u2019t tell you a company\u2019s actual tech stack, verified funding stage, or real headcount. Its search is filter-based, not queryable in natural language \u2014 and the signals it surfaces (like \u201Crecently posted\u201D) are often noise, not buying intent.\n\nCircl is fundamentally different: we only analyze your first-degree connections (people who already know you), we enrich each one with data from across the web (company websites, funding databases, tech stack detection), and we score every match against your specific ICP with a plain-English reason. You can query your network in natural language \u2014 \u201CVCs who invest in B2B SaaS at Series A\u201D \u2014 and we show you how long you\u2019ve been connected, so you know exactly how warm the relationship is.",
    },
    {
      q: "What makes Circl\u2019s data more accurate?",
      a: "LinkedIn relies on self-reported profiles \u2014 which are often outdated, vague, or incomplete. Circl goes further: we scrape up to 10 pages of each company\u2019s actual website (products, customers, pricing, team), cross-reference funding data, detect tech stack, and pull in verified headcount. This gives us a much richer, more current picture of each connection and their company than any profile-only tool.",
    },
    {
      q: "What are the main use cases?",
      a: "Circl works for any professional who wants to unlock their LinkedIn network. The most common use cases: finding potential customers (decision-makers at ICP-fit companies), finding investors (VCs, angels, PE who invest in your space), finding warm introductions (who do I know at a specific company?), finding advisors (senior operators with domain expertise), network intelligence (seniority breakdowns, industry distribution), and outreach prep (reconnecting with dormant relationships before a trip or conference).",
    },
    {
      q: "What can I ask the query engine?",
      a: "Almost anything. The query engine searches across a person\u2019s full work history, current company details, funding stage, company size, tech stack, seniority, geography, industry, and your connection duration \u2014 all in plain English. If the data exists in your enriched network, Circl can search it.",
    },
    {
      q: "How do you decide which connections get enriched?",
      a: "We classify every connection by seniority and role. C-suite, VPs, Directors, Founders, and Partners are always fully enriched \u2014 they\u2019re the decision-makers. Manager-level connections are enriched on paid plans. Individual contributors are available on-demand. Interns and students are excluded from scoring. This tiering ensures your budget goes toward the connections most likely to convert.",
    },
    {
      q: "Is my data safe?",
      a: "We never ask for your LinkedIn credentials and we never scrape LinkedIn on your behalf. You export your own connections CSV from LinkedIn settings \u2014 a file that sits on your computer. Your data is stored encrypted, processed only for your analysis, and never shared with other users or third parties.",
    },
  ];

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
            <button className="mobile-menu-btn">
              <svg viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="h-badge">
          <span className="dot"></span> Now in early access
        </div>
        <h1>
          Your LinkedIn network is worth more than your CRM.{" "}
          <span className="hl">You just can&apos;t see it yet.</span>
        </h1>
        <p className="h-sub">
          Circl turns your connections into a scored pipeline of customers and investors — and lets you query your entire network in plain English.
        </p>
        <div className="h-cta-wrap">
          <button className="btn-p" onClick={goLogin}>
            Get Started for Free{" "}
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" />
            </svg>
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
            "What\u2019s my seniority breakdown?",
            "PE partners backing B2B SaaS",
            "Connections in SF I should reconnect with",
            "VCs who invest in fintech at Series A",
            "Senior engineers who recently changed jobs",
            "Directors of Product in fintech",
            "Founders I\u2019ve known for 5+ years",
          ]
            .concat([
              "CTOs at Series B+ healthtech companies",
              "Angel investors in Bangalore",
              "Who do I know at Stripe?",
              "VPs of Engineering at 500+ companies",
              "Ex-McKinsey founders in my network",
              "What\u2019s my seniority breakdown?",
              "PE partners backing B2B SaaS",
              "Connections in SF I should reconnect with",
              "VCs who invest in fintech at Series A",
              "Senior engineers who recently changed jobs",
              "Directors of Product in fintech",
              "Founders I\u2019ve known for 5+ years",
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
              Circl pulls thousands of data points across work history, company financials, funding rounds, tech stack, and 10+ pages of company web presence — then scores every connection against your ideal customer profile.
            </p>
          </div>
          <div className="feat-visual rv">
            <div className="sp-layout">
              <div className="sp-left">
                <div className="sp-tabs">
                  <button
                    className={`sp-tab${activeTab === "customers" ? " active" : ""}`}
                    onClick={() => setActiveTab("customers")}
                  >
                    <span className="ico">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
                    </span>{" "}
                    Customers
                  </button>
                  <button
                    className={`sp-tab${activeTab === "investors" ? " active" : ""}`}
                    onClick={() => setActiveTab("investors")}
                  >
                    <span className="ico">
                      <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                    </span>{" "}
                    Investors
                  </button>
                  <button
                    className={`sp-tab${activeTab === "advisors" ? " active" : ""}`}
                    onClick={() => setActiveTab("advisors")}
                  >
                    <span className="ico">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                    </span>{" "}
                    Advisors
                  </button>
                </div>

                {/* CUSTOMERS TAB */}
                {activeTab === "customers" && (
                  <div className="sp-content active">
                    <h4>Find Decision-Makers at Your Best-Fit Companies</h4>
                    <p>Circl scans every connection&apos;s title, seniority, and function — then cross-references their company against your ICP: industry, headcount, funding stage, geography, and tech stack. Each match gets a 1–10 score with a plain-English reason explaining why they&apos;re a fit, how long you&apos;ve been connected, and what makes them reachable.</p>
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="qr-av" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>AK</div>
                        <div style={{ flex: 1 }}>
                          <div className="qr-name">Ankit Khanna</div>
                          <div className="qr-title">CTO &middot; Healthify &middot; Series C &middot; Bangalore</div>
                        </div>
                        <div className="qr-score">9.2</div>
                      </div>
                      <div style={{ fontSize: ".68rem", color: "var(--gray-1)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", lineHeight: 1.55 }}>
                        <strong style={{ color: "var(--orange)" }}>Why this match:</strong> Series C healthtech, 800 employees, ICP match on industry + size + title. CTO-level decision-maker. <span style={{ color: "var(--green)" }}>Connected since 2019 (6 years)</span> — warm lead, high reachability.
                      </div>
                    </div>
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

                {/* INVESTORS TAB */}
                {activeTab === "investors" && (
                  <div className="sp-content active">
                    <h4>Surface the Investors Who Actually Fund Your Space</h4>
                    <p>Circl identifies VCs, angels, and PE partners in your network — then scores each by fund type fit, investment stage match, sector focus, seniority at the firm, and how long you&apos;ve been connected. No more guessing who invests in what.</p>
                    <div className="scores">
                      <div className="score-row"><span className="score-lbl">Fund fit</span><div className="score-track"><div className="score-fill" style={{ width: "92%", background: "var(--orange)" }}></div></div><span className="score-val mono">9.2</span></div>
                      <div className="score-row"><span className="score-lbl">Stage</span><div className="score-track"><div className="score-fill" style={{ width: "85%", background: "var(--blue)" }}></div></div><span className="score-val mono">8.5</span></div>
                      <div className="score-row"><span className="score-lbl">Sector</span><div className="score-track"><div className="score-fill" style={{ width: "78%", background: "var(--green)" }}></div></div><span className="score-val mono">7.8</span></div>
                      <div className="score-row"><span className="score-lbl">Seniority</span><div className="score-track"><div className="score-fill" style={{ width: "90%", background: "var(--purple)" }}></div></div><span className="score-val mono">9.0</span></div>
                      <div className="score-row"><span className="score-lbl">Warmth</span><div className="score-track"><div className="score-fill" style={{ width: "70%", background: "var(--orange)" }}></div></div><span className="score-val mono">7.0</span></div>
                    </div>
                    <div className="sp-stats">
                      <div className="sp-stat">
                        <div className="sv mono">5</div>
                        <div className="sl">Scoring dimensions</div>
                      </div>
                      <div className="sp-stat">
                        <div className="sv mono">7+</div>
                        <div className="sl">Match threshold</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ADVISORS TAB */}
                {activeTab === "advisors" && (
                  <div className="sp-content active">
                    <h4>Identify Operators Who Could Actually Guide You</h4>
                    <p>Circl finds senior operators, domain experts, and industry veterans in your network — then weights each by domain relevance, seniority, and how long you&apos;ve actually known them. The best advisors are people you already have a relationship with.</p>
                    <div style={{ marginTop: 16 }}>
                      <div className="icp-group">
                        <div className="icp-lbl">Auto-filled from your website</div>
                        <div className="icp-pills">
                          <span className="icp-pill on">Healthtech</span>
                          <span className="icp-pill on">Fintech</span>
                          <span className="icp-pill on">B2B SaaS</span>
                          <span className="icp-pill">E-commerce</span>
                        </div>
                      </div>
                      <div className="icp-group">
                        <div className="icp-lbl">Target seniority</div>
                        <div className="icp-pills">
                          <span className="icp-pill on">C-Suite</span>
                          <span className="icp-pill on">VP</span>
                          <span className="icp-pill on">Director</span>
                          <span className="icp-pill">Manager</span>
                        </div>
                      </div>
                      <div className="icp-group">
                        <div className="icp-lbl">Relationship depth</div>
                        <div className="icp-pills">
                          <span className="icp-pill on">5+ years</span>
                          <span className="icp-pill on">2–5 years</span>
                          <span className="icp-pill">Under 2 years</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Vieu-style floating cards */}
              <div className="sp-right">
                {/* CUSTOMERS VISUAL */}
                <div className="vieu-graph" style={{ display: activeTab === "customers" ? "block" : "none" }}>
                  <div className="vieu-ring vieu-ring-1"></div>
                  <div className="vieu-ring vieu-ring-2"></div>
                  <div className="vieu-center"><div className="vieu-center-inner">YOU</div></div>
                  <div className="vieu-card" style={{ top: "10%", left: "5%" }}>
                    <div className="vc-name">Ankit Khanna</div>
                    <div className="vc-role">CTO &middot; Healthify</div>
                    <div className="vc-meta"><span className="vc-score">9.2</span><span className="vc-tag">Series C &middot; 800 emp</span></div>
                  </div>
                  <div className="vieu-card" style={{ top: "6%", right: "5%" }}>
                    <div className="vc-name">Priya Subramaniam</div>
                    <div className="vc-role">VP Eng &middot; Practo</div>
                    <div className="vc-meta"><span className="vc-score">8.7</span><span className="vc-tag">Industry match</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "18%", left: "3%" }}>
                    <div className="vc-name">Rahul Varma</div>
                    <div className="vc-role">CTO &middot; MedPrime</div>
                    <div className="vc-meta"><span className="vc-score">8.4</span><span className="vc-tag">Series B &middot; Mumbai</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "12%", right: "3%" }}>
                    <div className="vc-name">Neha Mehra</div>
                    <div className="vc-role">Dir. Eng &middot; CureFit</div>
                    <div className="vc-meta"><span className="vc-score">7.9</span><span className="vc-tag">Size + title fit</span></div>
                  </div>
                </div>

                {/* INVESTORS VISUAL */}
                <div className="vieu-graph" style={{ display: activeTab === "investors" ? "block" : "none" }}>
                  <div className="vieu-ring vieu-ring-1"></div>
                  <div className="vieu-ring vieu-ring-2"></div>
                  <div className="vieu-center"><div className="vieu-center-inner">YOU</div></div>
                  <div className="vieu-card" style={{ top: "8%", left: "5%" }}>
                    <div className="vc-name">Ravi Mehta</div>
                    <div className="vc-role">Partner &middot; Sequoia India</div>
                    <div className="vc-meta"><span className="vc-score">8.9</span><span className="vc-tag">Series A–B &middot; SaaS</span></div>
                  </div>
                  <div className="vieu-card" style={{ top: "5%", right: "3%" }}>
                    <div className="vc-name">Sanjay Nair</div>
                    <div className="vc-role">GP &middot; Accel</div>
                    <div className="vc-meta"><span className="vc-score">8.3</span><span className="vc-tag">Connected 7 yrs</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "18%", left: "8%" }}>
                    <div className="vc-name">Lisa Chen</div>
                    <div className="vc-role">Angel Investor</div>
                    <div className="vc-meta"><span className="vc-score">7.6</span><span className="vc-tag">Healthtech focus</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "10%", right: "5%" }}>
                    <div className="vc-name">David Park</div>
                    <div className="vc-role">MD &middot; Tiger Global</div>
                    <div className="vc-meta"><span className="vc-score">7.2</span><span className="vc-tag">Growth stage</span></div>
                  </div>
                </div>

                {/* ADVISORS VISUAL */}
                <div className="vieu-graph" style={{ display: activeTab === "advisors" ? "block" : "none" }}>
                  <div className="vieu-ring vieu-ring-1"></div>
                  <div className="vieu-ring vieu-ring-2"></div>
                  <div className="vieu-center"><div className="vieu-center-inner">YOU</div></div>
                  <div className="vieu-card" style={{ top: "8%", left: "3%" }}>
                    <div className="vc-name">Vikram Bhat</div>
                    <div className="vc-role">Ex-CTO &middot; Flipkart</div>
                    <div className="vc-meta"><span className="vc-score">9.1</span><span className="vc-tag">Connected 8 yrs</span></div>
                  </div>
                  <div className="vieu-card" style={{ top: "5%", right: "5%" }}>
                    <div className="vc-name">Meera Iyer</div>
                    <div className="vc-role">COO &middot; Freshworks (prev)</div>
                    <div className="vc-meta"><span className="vc-score">8.5</span><span className="vc-tag">SaaS ops expert</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "15%", left: "8%" }}>
                    <div className="vc-name">Arun Sharma</div>
                    <div className="vc-role">VP Product &middot; Razorpay</div>
                    <div className="vc-meta"><span className="vc-score">8.0</span><span className="vc-tag">Fintech domain</span></div>
                  </div>
                  <div className="vieu-card" style={{ bottom: "10%", right: "3%" }}>
                    <div className="vc-name">Sarah Johnson</div>
                    <div className="vc-role">Board Member &middot; 3 cos</div>
                    <div className="vc-meta"><span className="vc-score">7.7</span><span className="vc-tag">Connected 6 yrs</span></div>
                  </div>
                </div>
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
            <p className="ss">No filters. No dropdowns. Ask anything in plain English — across person data, company data, and relationship signals — and get scored, actionable results in seconds.</p>
          </div>

          {/* TOP ROW: Search (left) + Profile Card (right) */}
          <div className="ac-top rv">
            {/* LEFT: Search mockup */}
            <div className="ac-search-panel">
              <div className="search-mockup">
                <div className="qm-bar">
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <div className="qm-text">
                    <span ref={typedRef} id="typed"></span>
                    <span className="qm-cursor"></span>
                  </div>
                </div>
                <div className="qm-results" id="search-results">
                  <div className="qr" data-idx="0">
                    <div className="qr-av">AK</div>
                    <div className="qr-info"><div className="qr-name">Ankit Khanna</div><div className="qr-title">CTO &middot; Healthify &middot; Series C &middot; Bangalore</div></div>
                    <div className="qr-score">9.2</div>
                  </div>
                  <div className="qr" data-idx="1">
                    <div className="qr-av">PS</div>
                    <div className="qr-info"><div className="qr-name">Priya Subramaniam</div><div className="qr-title">VP Eng &middot; Practo &middot; 800 employees</div></div>
                    <div className="qr-score">8.7</div>
                  </div>
                  <div className="qr" data-idx="2">
                    <div className="qr-av">RV</div>
                    <div className="qr-info"><div className="qr-name">Rahul Varma</div><div className="qr-title">CTO &middot; MedPrime &middot; Series B &middot; Mumbai</div></div>
                    <div className="qr-score">8.4</div>
                  </div>
                  <div className="qr" data-idx="3">
                    <div className="qr-av">NM</div>
                    <div className="qr-info"><div className="qr-name">Neha Mehra</div><div className="qr-title">Dir. Eng &middot; CureFit &middot; Bangalore</div></div>
                    <div className="qr-score">7.9</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Profile panel */}
            <div className="ac-profile-panel" id="ac-profile">
              <div className="pp-header">
                <div className="pp-avatar" id="pp-av">AK</div>
                <div>
                  <div className="pp-name" id="pp-name">Ankit Khanna</div>
                  <div className="pp-role" id="pp-role">CTO &middot; Healthify &middot; Bangalore</div>
                </div>
                <div className="pp-score-big" id="pp-score">9.2</div>
              </div>
              <div className="pp-connected" id="pp-connected">
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "var(--green)", fill: "none", strokeWidth: 2, verticalAlign: "middle", marginRight: 4 }}>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Connected since <strong>2019</strong> — 6 years</span>
              </div>
              <div className="pp-reason" id="pp-reason">Series C healthtech company, 800 employees. Perfect ICP match on industry, company size, and title. CTO-level decision-maker with budget authority. Warm relationship — connected 6 years.</div>
              <div className="pp-section-label">Match signals</div>
              <div className="pp-facts" id="pp-facts">
                <span className="pp-fact">Healthtech</span>
                <span className="pp-fact">Series C</span>
                <span className="pp-fact">800 emp</span>
                <span className="pp-fact">CTO</span>
                <span className="pp-fact">Bangalore</span>
              </div>
              <div className="pp-section-label" style={{ marginTop: 12 }}>Company intel</div>
              <div className="pp-facts" id="pp-company">
                <span className="pp-fact">Health &amp; Wellness</span>
                <span className="pp-fact">$45M raised</span>
                <span className="pp-fact">React + Node stack</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="ac-divider rv">
            <span className="ac-divider-text">Ask anything. Here&apos;s what people search for.</span>
          </div>

          {/* BOTTOM: Queries box */}
          <div className="qe-box rv">
            <div className="qe-box-left">
              <h4>The queries are endless.</h4>
              <p>Ask about past experience, current company, funding, seniority, geography, connection history, and more. If the data exists, Circl can search it.</p>
              <div className="qe-cats">
                {qeCats.map((cat, i) => (
                  <span
                    key={cat}
                    className={`qe-cat-pill${activeCatIdx === i ? " active" : ""}`}
                    onClick={() => handleCatClick(i)}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            <div className="qe-box-right">
              <div className="qe-active-cat mono">{qeCats[activeCatIdx]}</div>
              <div className="qe-query-list">
                {qeData[qeCats[activeCatIdx]].map((q, i) => (
                  <div key={i} className="qe-query-item">{q}</div>
                ))}
              </div>
            </div>
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
              { n: "3", title: "We enrich + score", desc: "Thousands of data points across the web. AI scores each connection against your profile.", time: "~15 min (auto)" },
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
      <section className="pricing-section" id="pricing">
        <div className="sc">
          <div className="ctr rv">
            <div className="badge">Pricing</div>
            <h2 className="st">One price. Your whole network.</h2>
            <p className="ss">Pay based on your network size. Analyze, query, and re-match all year.</p>
          </div>
          <div className="pricing-free rv" style={{ marginTop: 32 }}>
            <strong>Start free with 100 connections</strong> — no card required. <a href="#" onClick={(e) => { e.preventDefault(); goLogin(); }}>Get started →</a>
          </div>
          <div className="pricing-layout rv">
            <div className="pr-card">
              <div className="pr-name">Starter</div>
              <div className="pr-conn">Up to 1,500 connections</div>
              <div className="pr-amt">$100 <span className="sm">/yr</span></div>
              <div className="pr-per">~$0.07/connection</div>
              <button className="pr-btn" onClick={goLogin}>Get Started</button>
            </div>
            <div className="pr-card feat-p">
              <div className="pr-tag mono">Most Popular</div>
              <div className="pr-name">Growth</div>
              <div className="pr-conn">Up to 5,000 connections</div>
              <div className="pr-amt">$300 <span className="sm">/yr</span></div>
              <div className="pr-per">~$0.06/connection</div>
              <button className="pr-btn" onClick={goLogin}>Get Started</button>
            </div>
            <div className="pr-card">
              <div className="pr-name">Scale</div>
              <div className="pr-conn">Up to 10,000 connections</div>
              <div className="pr-amt">$500 <span className="sm">/yr</span></div>
              <div className="pr-per">~$0.05/connection</div>
              <button className="pr-btn" onClick={goLogin}>Get Started</button>
            </div>
            <div className="pr-card">
              <div className="pr-name">Enterprise</div>
              <div className="pr-conn">Up to 25,000 connections</div>
              <div className="pr-amt">$700 <span className="sm">/yr</span></div>
              <div className="pr-per">~$0.03/connection</div>
              <button className="pr-btn" onClick={goLogin}>Get Started</button>
            </div>
          </div>
          <div className="all-plans rv">
            <h4>All plans include:</h4>
            <div className="all-plans-grid">
              <div className="ap-item">Full enrichment with 30+ data points</div>
              <div className="ap-item">AI scoring with plain-English reasons</div>
              <div className="ap-item">Customer, Investor &amp; Advisor modes</div>
              <div className="ap-item">Natural language query engine</div>
              <div className="ap-item">ICP auto-fill from your website</div>
              <div className="ap-item">Re-match anytime your ICP changes</div>
              <div className="ap-item">CSV re-upload as your network grows</div>
              <div className="ap-item">Company deep-scrape (10+ pages)</div>
              <div className="ap-item">Email + WhatsApp notifications</div>
            </div>
          </div>
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
            {faqItems.map((faq, i) => (
              <div key={i} className={`faq-item rv${openFaq === i ? " open" : ""}`}>
                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
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
          <button className="btn-p" onClick={goLogin}>
            Get Started for Free{" "}
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" />
            </svg>
          </button>
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
  --surface-4:#1c1c1c;
  --border:rgba(255,255,255,.08);
  --border-h:rgba(255,255,255,.14);
  --white:#ededed;
  --gray-1:#a0a0a0;
  --gray-2:#666;
  --gray-3:#444;
  --orange:#e85d26;
  --orange-soft:rgba(232,93,38,.08);
  --orange-glow:rgba(232,93,38,.12);
  --orange-mid:rgba(232,93,38,.3);
  --green:#00d47b;
  --blue:#4d90fe;
  --purple:#a78bfa;
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
.landing .mobile-menu-btn{display:none;background:none;border:none;color:var(--white);padding:4px}
.landing .mobile-menu-btn svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2}

.landing .hero{
  padding:120px 20px 60px;max-width:1120px;margin:0 auto;
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
  margin-bottom:28px;animation:landing-fu .5s ease both;
}
.landing .h-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}
.landing h1{
  font-size:2.5rem;font-weight:800;line-height:1.08;letter-spacing:-.045em;
  max-width:720px;margin:0 auto;animation:landing-fu .5s .05s ease both;
}
.landing h1 .hl{color:var(--orange)}
.landing .h-sub{
  font-size:1rem;color:var(--gray-1);max-width:520px;
  margin:20px auto 0;font-weight:400;line-height:1.65;letter-spacing:-.01em;
  animation:landing-fu .5s .1s ease both;
}
.landing .h-cta-wrap{margin-top:32px;animation:landing-fu .5s .15s ease both}
.landing .btn-p{
  background:var(--orange);color:#fff;
  padding:14px 32px;border-radius:10px;
  font-weight:600;font-size:.95rem;border:none;
  transition:all .2s;display:inline-flex;align-items:center;gap:8px;
}
.landing .btn-p:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 8px 24px rgba(232,93,38,.25)}
.landing .btn-p svg{width:14px;height:14px}
.landing .h-trust{
  display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;
  margin-top:40px;font-size:.78rem;color:var(--gray-2);
  animation:landing-fu .5s .2s ease both;
}
.landing .h-trust span{display:flex;align-items:center;gap:5px}
.landing .h-trust svg{width:14px;height:14px;stroke:var(--gray-2);fill:none;stroke-width:2}
.landing .h-trust .sep{width:3px;height:3px;border-radius:50%;background:var(--gray-3)}
@keyframes landing-fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

.landing section{padding:80px 20px}
.landing .sc{max-width:1120px;margin:0 auto}
.landing .badge{
  font-family:'Geist Mono',monospace;
  font-size:.6875rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
  color:var(--orange);padding:5px 12px;border-radius:100px;
  background:var(--orange-soft);border:1px solid rgba(232,93,38,.12);
  display:inline-block;margin-bottom:16px;
}
.landing .st{font-size:1.8rem;font-weight:800;line-height:1.12;letter-spacing:-.035em}
.landing .ss{font-size:.95rem;color:var(--gray-1);margin-top:12px;max-width:480px;letter-spacing:-.01em;line-height:1.6}
.landing .ctr{text-align:center}
.landing .ctr .ss{margin-left:auto;margin-right:auto}

.landing .ico{
  width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;
  vertical-align:middle;margin-right:4px;
}
.landing .ico svg{width:18px;height:18px;stroke:var(--orange);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.landing .qc-wrap{padding:0 0 60px;overflow:hidden;position:relative}
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
  color:var(--gray-1);white-space:nowrap;transition:all .2s;
}
.landing .qc-chip:hover{border-color:var(--orange);color:var(--orange)}
@keyframes landing-qcScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

.landing .prob-grid{
  display:grid;grid-template-columns:1fr;gap:1px;
  background:var(--border);border-radius:var(--r-lg);
  overflow:hidden;margin-top:40px;
}
.landing .prob-c{background:var(--surface);padding:28px 24px;transition:background .3s}
.landing .prob-c:hover{background:var(--surface-2)}
.landing .prob-c .n{font-family:'Geist Mono',monospace;font-size:.6875rem;color:var(--orange);margin-bottom:14px;font-weight:600}
.landing .prob-c h3{font-size:1.02rem;font-weight:700;margin-bottom:6px;letter-spacing:-.02em}
.landing .prob-c p{font-size:.85rem;color:var(--gray-1);line-height:1.6}
.landing .trans{text-align:center;padding:36px 20px 0;font-size:1.05rem;font-weight:600;color:var(--gray-2);letter-spacing:-.01em}
.landing .trans strong{color:var(--white)}

.landing .feat{border-top:1px solid var(--border)}
.landing .feat-head{margin-bottom:40px}
.landing .feat-visual{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);overflow:hidden;position:relative;
}

.landing .sp-layout{display:flex;flex-direction:column}
.landing .sp-left{padding:32px 24px}
.landing .sp-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.landing .sp-tab{
  padding:8px 16px;border-radius:8px;
  font-size:.8125rem;font-weight:600;
  background:var(--surface-2);border:1px solid var(--border);
  color:var(--gray-1);cursor:pointer;transition:all .2s;
  display:inline-flex;align-items:center;gap:6px;
}
.landing .sp-tab.active{background:var(--orange-soft);border-color:rgba(232,93,38,.2);color:var(--orange)}
.landing .sp-tab .ico svg{width:14px;height:14px}

.landing .sp-content{display:block}
.landing .sp-content.active{display:block}
.landing .sp-content h4{font-size:1.05rem;font-weight:700;margin-bottom:6px;letter-spacing:-.02em}
.landing .sp-content>p{font-size:.85rem;color:var(--gray-1);line-height:1.65;margin-bottom:20px}
.landing .sp-stats{display:flex;gap:20px;flex-wrap:wrap;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
.landing .sp-stat .sv{font-family:'Geist Mono',monospace;font-size:1.3rem;font-weight:700;color:var(--orange)}
.landing .sp-stat .sl{font-size:.7rem;color:var(--gray-2);margin-top:2px}

.landing .sp-right{
  border-top:1px solid var(--border);
  position:relative;overflow:hidden;
  background:var(--surface-2);min-height:360px;
  padding:32px 24px;
}

.landing .vieu-graph{position:relative;width:100%;height:100%;min-height:320px}
.landing .vieu-center{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:80px;height:80px;border-radius:50%;
  background:radial-gradient(circle,var(--orange-glow) 0%,transparent 70%);
  display:flex;align-items:center;justify-content:center;
  z-index:3;
}
.landing .vieu-center-inner{
  width:52px;height:52px;border-radius:50%;
  background:var(--surface);border:2px solid var(--orange);
  display:flex;align-items:center;justify-content:center;
  font-size:.6rem;font-weight:800;color:var(--orange);
  letter-spacing:.05em;
}
.landing .vieu-ring{
  position:absolute;left:50%;top:50%;border-radius:50%;
  border:1px solid rgba(232,93,38,.06);
  transform:translate(-50%,-50%);
}
.landing .vieu-ring-1{width:180px;height:180px}
.landing .vieu-ring-2{width:300px;height:300px}

.landing .vieu-card{
  position:absolute;z-index:4;
  background:var(--surface);border:1px solid var(--border);
  border-radius:10px;padding:10px 14px;
  min-width:160px;transition:all .35s;
  box-shadow:0 4px 20px rgba(0,0,0,.3);
}
.landing .vieu-card:hover{border-color:var(--border-h);transform:scale(1.03)}
.landing .vieu-card .vc-name{font-size:.78rem;font-weight:700}
.landing .vieu-card .vc-role{font-size:.65rem;color:var(--gray-2);margin-top:1px}
.landing .vieu-card .vc-meta{
  display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;
}
.landing .vieu-card .vc-score{
  font-family:'Geist Mono',monospace;font-size:.6rem;font-weight:700;
  padding:2px 7px;border-radius:5px;
  background:var(--orange-soft);color:var(--orange);
}
.landing .vieu-card .vc-tag{
  font-size:.55rem;color:var(--gray-2);padding:2px 6px;
  border-radius:4px;background:var(--surface-3);
}

.landing .scores{padding:12px 0}
.landing .score-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.landing .score-row:last-child{margin:0}
.landing .score-lbl{font-size:.72rem;font-weight:600;width:64px;text-align:right;color:var(--gray-1);flex-shrink:0}
.landing .score-track{flex:1;height:6px;background:var(--surface-3);border-radius:100px;overflow:hidden}
.landing .score-fill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.23,1,.32,1)}
.landing .score-val{font-family:'Geist Mono',monospace;font-size:.7rem;font-weight:600;width:24px;color:var(--gray-1)}

.landing .icp-group{margin-bottom:12px}
.landing .icp-group:last-child{margin:0}
.landing .icp-lbl{font-family:'Geist Mono',monospace;font-size:.6rem;font-weight:500;color:var(--gray-2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
.landing .icp-pills{display:flex;flex-wrap:wrap;gap:5px}
.landing .icp-pill{
  padding:4px 10px;border-radius:100px;font-size:.68rem;font-weight:600;
  border:1px solid var(--border);background:var(--surface-3);color:var(--gray-1);
}
.landing .icp-pill.on{background:var(--orange-soft);border-color:rgba(232,93,38,.2);color:var(--orange)}

.landing .ac-top{
  display:grid;grid-template-columns:1fr;gap:12px;
}
.landing .ac-search-panel{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);overflow:hidden;
}
.landing .ac-profile-panel{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:32px 28px;
  transition:all .5s cubic-bezier(.23,1,.32,1);
  min-height:380px;display:flex;flex-direction:column;justify-content:center;
}
.landing .ac-profile-panel:hover{border-color:var(--border-h)}

.landing .ac-divider{
  text-align:center;padding:48px 20px;position:relative;
}
.landing .ac-divider::before{
  content:'';position:absolute;left:50%;top:50%;
  transform:translate(-50%,-50%);
  width:200px;height:1px;
  background:linear-gradient(90deg,transparent,var(--border-h),transparent);
}
.landing .ac-divider-text{
  display:inline-block;background:var(--bg);
  padding:0 20px;position:relative;z-index:1;
  font-size:.85rem;color:var(--gray-2);font-weight:500;
  letter-spacing:-.01em;
}

.landing .pp-connected{
  font-size:.78rem;color:var(--green);margin:12px 0 16px;
  display:flex;align-items:center;
}
.landing .pp-connected strong{color:var(--white)}
.landing .pp-section-label{
  font-family:'Geist Mono',monospace;font-size:.6rem;font-weight:600;
  color:var(--gray-2);text-transform:uppercase;letter-spacing:.1em;
  margin-bottom:8px;margin-top:16px;
}

.landing .search-mockup{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;position:relative}
.landing .qm-bar{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}
.landing .qm-bar svg{width:16px;height:16px;stroke:var(--gray-2);fill:none;stroke-width:2;flex-shrink:0}
.landing .qm-text{font-size:.875rem;color:var(--white)}
.landing .qm-cursor{display:inline-block;width:1.5px;height:1em;background:var(--orange);margin-left:1px;animation:landing-blink 1s infinite;vertical-align:middle}
@keyframes landing-blink{0%,50%{opacity:1}51%,100%{opacity:0}}

.landing .qm-results{padding:12px 16px;position:relative;min-height:260px}
.landing .qr{
  display:flex;align-items:center;gap:10px;
  padding:10px 0;border-bottom:1px solid var(--border);
  transition:all .3s;cursor:pointer;position:relative;
}
.landing .qr:last-child{border:none}
.landing .qr:hover{background:var(--surface-2);margin:0 -16px;padding:10px 16px;border-radius:8px}
.landing .qr-av{
  width:32px;height:32px;border-radius:8px;
  background:var(--surface-3);display:flex;align-items:center;justify-content:center;
  font-size:.65rem;font-weight:700;color:var(--gray-2);flex-shrink:0;
}
.landing .qr-info{flex:1}
.landing .qr-name{font-weight:600;font-size:.8125rem}
.landing .qr-title{font-size:.7rem;color:var(--gray-2);margin-top:1px}
.landing .qr-score{
  font-family:'Geist Mono',monospace;font-size:.6875rem;font-weight:600;
  padding:3px 8px;border-radius:6px;background:var(--orange-soft);color:var(--orange);
}

.landing .pp-header{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.landing .pp-avatar{
  width:48px;height:48px;border-radius:12px;
  background:var(--orange-soft);display:flex;align-items:center;justify-content:center;
  font-size:.85rem;font-weight:800;color:var(--orange);
}
.landing .pp-name{font-size:1rem;font-weight:700}
.landing .pp-role{font-size:.78rem;color:var(--gray-1);margin-top:2px}
.landing .pp-score-big{
  margin-left:auto;font-family:'Geist Mono',monospace;
  font-size:1.5rem;font-weight:800;color:var(--orange);
}
.landing .pp-reason{font-size:.78rem;color:var(--gray-1);line-height:1.6;margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border)}
.landing .pp-facts{display:flex;gap:10px;flex-wrap:wrap}
.landing .pp-fact{
  padding:5px 10px;border-radius:6px;font-size:.68rem;font-weight:600;
  background:var(--surface-3);border:1px solid var(--border);color:var(--gray-1);
}

.landing .qe-box{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);overflow:hidden;
  display:grid;grid-template-columns:1fr;min-height:260px;
}
.landing .qe-box-left{
  padding:32px 28px;
}
.landing .qe-box-left h4{font-size:1.1rem;font-weight:700;margin-bottom:8px}
.landing .qe-box-left p{font-size:.85rem;color:var(--gray-1);line-height:1.65;margin-bottom:20px}
.landing .qe-cats{display:flex;flex-wrap:wrap;gap:8px}
.landing .qe-cat-pill{
  padding:6px 14px;border-radius:100px;font-size:.72rem;font-weight:600;
  background:var(--surface-3);border:1px solid var(--border);color:var(--gray-1);
  cursor:pointer;transition:all .2s;
}
.landing .qe-cat-pill:hover,.landing .qe-cat-pill.active{background:var(--orange-soft);border-color:rgba(232,93,38,.2);color:var(--orange)}
.landing .qe-box-right{
  border-top:1px solid var(--border);
  padding:28px;display:flex;flex-direction:column;justify-content:center;
  background:var(--surface-2);
}
.landing .qe-active-cat{
  font-size:.65rem;font-weight:600;color:var(--orange);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;
  transition:opacity .3s;
}
.landing .qe-query-list{display:flex;flex-direction:column;gap:8px}
.landing .qe-query-item{
  font-family:'Geist Mono',monospace;font-size:.75rem;color:var(--gray-1);
  padding:10px 16px;background:var(--surface-3);border:1px solid var(--border);
  border-radius:8px;line-height:1.5;transition:all .3s;
}
.landing .qe-query-item:hover{border-color:var(--orange);color:var(--orange)}

.landing .hw-grid{
  display:grid;grid-template-columns:1fr;gap:1px;
  background:var(--border);border-radius:var(--r-lg);
  overflow:hidden;margin-top:40px;
}
.landing .hw-step{background:var(--surface);padding:28px 24px;text-align:center;transition:background .3s}
.landing .hw-step:hover{background:var(--surface-2)}
.landing .hw-num{
  width:36px;height:36px;border-radius:50%;
  border:1px solid rgba(232,93,38,.2);background:var(--orange-soft);
  display:flex;align-items:center;justify-content:center;
  font-family:'Geist Mono',monospace;font-size:.78rem;font-weight:600;
  color:var(--orange);margin:0 auto 16px;
}
.landing .hw-step h3{font-size:.92rem;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
.landing .hw-step p{font-size:.8rem;color:var(--gray-1);line-height:1.55}
.landing .hw-time{font-family:'Geist Mono',monospace;font-size:.67rem;color:var(--orange);margin-top:10px;opacity:.6}

.landing .pricing-section{border-top:1px solid var(--border)}
.landing .pricing-free{
  text-align:center;font-size:.85rem;color:var(--gray-1);margin-bottom:32px;
}
.landing .pricing-free strong{color:var(--white)}
.landing .pricing-free a{color:var(--orange);font-weight:600;text-decoration:underline;text-underline-offset:3px}

.landing .pricing-layout{
  display:grid;grid-template-columns:1fr;gap:12px;
}
.landing .pr-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:28px 20px;text-align:center;
  transition:all .3s;display:flex;flex-direction:column;
}
.landing .pr-card:hover{border-color:var(--border-h);transform:translateY(-2px)}
.landing .pr-card.feat-p{
  background:linear-gradient(180deg,rgba(232,93,38,.04) 0%,var(--surface) 50%);
  border-color:rgba(232,93,38,.2);
}
.landing .pr-tag{font-family:'Geist Mono',monospace;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--orange);margin-bottom:4px;font-weight:600}
.landing .pr-name{font-size:1.05rem;font-weight:700;margin-bottom:2px}
.landing .pr-conn{font-size:.72rem;color:var(--gray-2);margin-bottom:16px}
.landing .pr-amt{font-size:2.2rem;font-weight:800;letter-spacing:-.04em;line-height:1}
.landing .pr-amt .sm{font-size:.8rem;font-weight:500;color:var(--gray-2)}
.landing .pr-per{font-family:'Geist Mono',monospace;font-size:.67rem;color:var(--gray-2);margin-top:4px;margin-bottom:20px}
.landing .pr-btn{
  margin-top:auto;width:100%;padding:11px 0;border-radius:8px;
  font-size:.8125rem;font-weight:600;transition:all .2s;
  border:1px solid var(--border);background:transparent;color:var(--white);
}
.landing .pr-btn:hover{border-color:var(--orange);color:var(--orange)}
.landing .pr-card.feat-p .pr-btn{background:var(--orange);border-color:var(--orange);color:#fff}
.landing .pr-card.feat-p .pr-btn:hover{filter:brightness(1.1)}

.landing .all-plans{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:28px 24px;margin-top:16px;
}
.landing .all-plans h4{font-size:.92rem;font-weight:700;margin-bottom:14px}
.landing .all-plans-grid{display:grid;grid-template-columns:1fr;gap:8px}
.landing .ap-item{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--gray-1)}
.landing .ap-item::before{content:'\\2713';color:var(--orange);font-weight:700;font-size:.72rem;flex-shrink:0}

.landing .faq-list{max-width:640px;margin:40px auto 0}
.landing .faq-item{border-bottom:1px solid var(--border);padding:18px 0}
.landing .faq-q{
  font-size:.92rem;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  letter-spacing:-.01em;
}
.landing .faq-t{
  width:24px;height:24px;border-radius:6px;
  background:var(--surface-2);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  color:var(--gray-1);font-size:.9rem;font-weight:300;flex-shrink:0;transition:all .25s;
}
.landing .faq-item.open .faq-t{transform:rotate(45deg);color:var(--orange);background:var(--orange-soft);border-color:rgba(232,93,38,.15)}
.landing .faq-a{
  max-height:0;overflow:hidden;
  transition:max-height .35s ease,padding .35s ease;
  font-size:.85rem;line-height:1.7;color:var(--gray-1);
  white-space:pre-line;
}
.landing .faq-item.open .faq-a{max-height:400px;padding-top:12px}

.landing .cta-final{
  padding:100px 20px;text-align:center;position:relative;border-top:1px solid var(--border);
}
.landing .cta-final::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:500px;height:500px;
  background:radial-gradient(circle,var(--orange-glow) 0%,transparent 60%);
  pointer-events:none;opacity:.5;
}
.landing .cta-final h2{font-size:2.2rem;font-weight:800;letter-spacing:-.04em;line-height:1.1;max-width:520px;margin:0 auto 14px}
.landing .cta-final h2 .hl{color:var(--orange)}
.landing .cta-final p{color:var(--gray-1);font-size:.95rem;margin-bottom:28px}

.landing footer{
  border-top:1px solid var(--border);padding:28px 20px;
  max-width:1120px;margin:0 auto;
  display:flex;align-items:center;justify-content:space-between;
  font-size:.72rem;color:var(--gray-2);
}
.landing .f-logo{font-weight:700;font-size:1rem;color:var(--white)}

.landing .rv{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}
.landing .rv.vis{opacity:1;transform:translateY(0)}

@media(min-width:768px){
  .landing .hero{padding:140px 24px 80px}
  .landing h1{font-size:3.4rem}
  .landing .h-sub{font-size:1.05rem}
  .landing section{padding:100px 24px}
  .landing .st{font-size:2.2rem}
  .landing .prob-grid{grid-template-columns:repeat(3,1fr)}
  .landing .hw-grid{grid-template-columns:repeat(4,1fr)}
  .landing .sp-layout{flex-direction:row}
  .landing .sp-left{width:50%;padding:36px 32px}
  .landing .sp-right{width:50%;border-top:none;border-left:1px solid var(--border)}
  .landing .ac-top{grid-template-columns:1fr 1fr}
  .landing .qe-box{grid-template-columns:1fr 1fr}
  .landing .qe-box-right{border-top:none;border-left:1px solid var(--border)}
  .landing .pricing-layout{grid-template-columns:repeat(4,1fr)}
  .landing .all-plans-grid{grid-template-columns:repeat(2,1fr)}
  .landing .mobile-menu-btn{display:none}
}

@media(min-width:1024px){
  .landing h1{font-size:4.25rem}
  .landing .h-sub{font-size:1.12rem}
  .landing .st{font-size:2.5rem}
  .landing .sp-left{padding:40px 36px}
  .landing .all-plans-grid{grid-template-columns:repeat(3,1fr)}
}

@media(max-width:767px){
  .landing .nav-r a{display:none}
  .landing .mobile-menu-btn{display:flex}
}
`;
