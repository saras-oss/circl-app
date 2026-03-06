export interface FunctionTheme {
  id: string;
  label: string;
  description: string;
  titles: string[];
}

export const FUNCTION_THEMES: FunctionTheme[] = [
  {
    id: "engineering_technology",
    label: "Engineering & Technology",
    description: "Technical leadership \u2014 builds and scales products",
    titles: [
      "CTO",
      "VP Engineering",
      "Head of Engineering",
      "Director of Engineering",
      "Chief Architect",
      "VP Technology",
      "Head of Data",
      "Head of Infrastructure",
      "Head of AI/ML",
      "Principal Engineer",
      "Engineering Manager",
    ],
  },
  {
    id: "product",
    label: "Product",
    description: "Product strategy and management",
    titles: [
      "CPO",
      "VP Product",
      "Head of Product",
      "Director of Product Management",
      "Chief Product Officer",
      "Head of Design",
      "Product Lead",
    ],
  },
  {
    id: "operations",
    label: "Operations",
    description: "Business operations and process",
    titles: [
      "COO",
      "VP Operations",
      "Head of Operations",
      "Director of Supply Chain",
      "Head of Process",
      "Chief Operating Officer",
      "Director of Strategy",
    ],
  },
  {
    id: "sales_business_development",
    label: "Sales & Business Development",
    description: "Revenue, partnerships, and growth",
    titles: [
      "CRO",
      "VP Sales",
      "Head of BD",
      "Director of Partnerships",
      "Chief Commercial Officer",
      "Head of Revenue",
      "VP Business Development",
      "Director of Sales",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Brand, demand generation, and growth marketing",
    titles: [
      "CMO",
      "VP Marketing",
      "Head of Growth",
      "Director of Brand",
      "Head of Demand Gen",
      "Chief Marketing Officer",
      "Director of Marketing",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Financial leadership and planning",
    titles: [
      "CFO",
      "VP Finance",
      "Head of FP&A",
      "Controller",
      "Treasurer",
      "Chief Financial Officer",
      "Director of Finance",
      "Finance Manager",
    ],
  },
  {
    id: "hr_people",
    label: "HR & People",
    description: "Talent, people operations, and culture",
    titles: [
      "CHRO",
      "VP People",
      "Head of Talent",
      "Director of HR",
      "Head of People Operations",
      "Chief People Officer",
      "Head of Talent Acquisition",
    ],
  },
  {
    id: "it_security",
    label: "IT & Security",
    description: "Information technology and cybersecurity",
    titles: [
      "CIO",
      "CISO",
      "VP IT",
      "Head of IT",
      "Director of Information Security",
      "Chief Information Officer",
      "Head of Cybersecurity",
      "IT Director",
    ],
  },
  {
    id: "legal_compliance",
    label: "Legal & Compliance",
    description: "Legal affairs, governance, and regulatory",
    titles: [
      "CLO",
      "General Counsel",
      "VP Legal",
      "Head of Compliance",
      "Chief Legal Officer",
      "Director of Legal",
      "Chief Compliance Officer",
    ],
  },
  {
    id: "general_management",
    label: "General Management",
    description: "Executive leadership and general management",
    titles: [
      "CEO",
      "Managing Director",
      "Founder",
      "Co-Founder",
      "President",
      "Country Head",
      "General Manager",
      "Regional Director",
    ],
  },
];

export function getFunctionLabel(id: string): string {
  return FUNCTION_THEMES.find((f) => f.id === id)?.label || id;
}

export function getFunctionLabels(ids: string[]): string[] {
  return ids.map(getFunctionLabel);
}

export function titleToFunctionId(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  for (const theme of FUNCTION_THEMES) {
    if (theme.titles.some((t) => t.toLowerCase() === lowerTitle)) {
      return theme.id;
    }
  }
  return null;
}

export function deriveFunctionsFromTitles(titles: string[]): string[] {
  const functionIds = new Set<string>();
  for (const title of titles) {
    const fId = titleToFunctionId(title);
    if (fId) functionIds.add(fId);
  }
  return Array.from(functionIds);
}

export function serializeFunctionsForPrompt(
  functionIds: string[],
  titles?: string[]
): string {
  if (!functionIds || functionIds.length === 0) return "Not specified";

  const parts = functionIds.map((id) => {
    const theme = FUNCTION_THEMES.find((f) => f.id === id);
    if (!theme) return id;

    const relevantTitles = (titles || []).filter((t) =>
      theme.titles.some((tt) => tt.toLowerCase() === t.toLowerCase())
    );

    if (relevantTitles.length > 0) {
      return `${theme.label} (specifically: ${relevantTitles.join(", ")})`;
    }
    return `${theme.label} (all senior roles)`;
  });

  return parts.join(", ");
}
