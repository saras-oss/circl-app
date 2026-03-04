export interface IndustryTheme {
  theme: string;
  description: string;
  subIndustries: string[];
}

export const INDUSTRY_TAXONOMY: IndustryTheme[] = [
  {
    theme: "Technology & Software",
    description: "SaaS, AI / ML, Cybersecurity, Developer Tools",
    subIndustries: [
      "SaaS",
      "AI / ML",
      "Cybersecurity",
      "Developer Tools",
      "Data & Analytics",
      "Enterprise Software",
      "Cloud & Infrastructure",
      "Internet & Web Services",
      "Hardware & Semiconductors",
      "Telecommunications & Networking",
      "Robotics & Automation",
      "Blockchain & Web3",
    ],
  },
  {
    theme: "Financial Services",
    description: "Fintech, Banking & Lending, Insurance / Insurtech",
    subIndustries: [
      "Fintech",
      "Banking & Lending",
      "Insurance / Insurtech",
      "Payments & Processing",
      "Investment & Wealth Management",
      "Capital Markets",
    ],
  },
  {
    theme: "Healthcare & Life Sciences",
    description: "HealthTech / Digital Health, Biotech & Pharma, Medical Devices",
    subIndustries: [
      "HealthTech / Digital Health",
      "Biotech & Pharma",
      "Medical Devices",
      "Healthcare Services",
      "Clinical Research",
    ],
  },
  {
    theme: "Consumer & Retail",
    description: "E-commerce, D2C Brands, Marketplace",
    subIndustries: [
      "E-commerce",
      "D2C Brands",
      "Marketplace",
      "Food & Beverage",
      "Consumer Electronics",
    ],
  },
  {
    theme: "Industrial & Energy",
    description: "Manufacturing, Logistics & Supply Chain, Energy & Oil",
    subIndustries: [
      "Manufacturing",
      "Logistics & Supply Chain",
      "Energy & Oil",
      "Cleantech / Climate",
      "Construction & Real Estate",
    ],
  },
  {
    theme: "Professional & Business Services",
    description: "IT Services, Consulting, Staffing & Recruitment",
    subIndustries: [
      "IT Services & Consulting",
      "IT Outsourcing / Managed Services",
      "Systems Integration",
      "Staffing & Recruitment",
      "Legal Tech",
      "HR Tech",
    ],
  },
  {
    theme: "Media & Education",
    description: "Media & Publishing, EdTech / E-Learning, Gaming",
    subIndustries: [
      "Media & Publishing",
      "EdTech / E-Learning",
      "Gaming",
      "Advertising & MarTech",
    ],
  },
  {
    theme: "Real Estate & Infrastructure",
    description: "Real Estate / PropTech, Commercial Real Estate, Construction Tech",
    subIndustries: [
      "Real Estate / PropTech",
      "Commercial Real Estate",
      "Construction Tech",
    ],
  },
];

export const COMPANY_HEADCOUNT = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–500 employees",
  "501–1,000 employees",
  "1,001–5,000 employees",
  "5,001–10,000 employees",
  "10,000+ employees",
];

export const REVENUE_RANGES = [
  "Pre-revenue",
  "$0–$1M ARR",
  "$1M–$5M ARR",
  "$5M–$20M ARR",
  "$20M–$100M ARR",
  "$100M+ ARR",
];

export const FUNDING_STAGES = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
  "PE-backed",
  "Public",
  "Bootstrapped",
];

export const GEOGRAPHIES = [
  "North America",
  "Europe",
  "UK",
  "APAC",
  "MENA",
  "LATAM",
  "India",
  "Global",
];

export const DEFAULT_TITLES = [
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "CISO",
  "CIO",
  "VP Engineering",
  "VP Product",
  "VP Sales",
  "VP Marketing",
  "Head of IT",
  "Head of Data",
  "Head of Engineering",
  "Director of Engineering",
  "Director of Product",
  "General Manager",
  "Managing Director",
];
