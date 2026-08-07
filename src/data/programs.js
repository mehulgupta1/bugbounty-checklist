export const PROGRAMS = [
  {
    id: "p1",
    name: "Acme Corp (VDP)",
    platform: "HackerOne",
    type: "Public",
    payouts: { critical: "$2,000", high: "$1,000", medium: "$500", low: "$100" },
    responseRate: "100%",
    difficulty: "Easy",
    competition: "Low",
    tags: ["Wide Scope", "Web", "VDP"],
    scope: ["*.acme.com", "api.acme.com", "admin.acme.internal"]
  },
  {
    id: "p2",
    name: "Logistics SaaS",
    platform: "Bugcrowd",
    type: "Public",
    payouts: { critical: "$5,000", high: "$2,000", medium: "$750", low: "$200" },
    responseRate: "88%",
    difficulty: "Medium",
    competition: "Low",
    tags: ["SaaS", "B2B", "API"],
    scope: ["app.logisticssaas.com", "api.logisticssaas.com"]
  },
  {
    id: "p3",
    name: "Regional Bank Europe",
    platform: "YesWeHack",
    type: "Public",
    payouts: { critical: "€10,000", high: "€4,000", medium: "€1,000", low: "€250" },
    responseRate: "95%",
    difficulty: "Medium",
    competition: "Low",
    tags: ["Fintech", "Web", "Mobile"],
    scope: ["*.eurobank.eu", "mobile-api.eurobank.eu"]
  },
  {
    id: "p4",
    name: "Healthcare App",
    platform: "HackerOne",
    type: "Private",
    payouts: { critical: "$15,000", high: "$5,000", medium: "$1,000", low: "$200" },
    responseRate: "92%",
    difficulty: "Hard",
    competition: "Medium",
    tags: ["Health", "Mobile", "API"],
    scope: ["patient.healthapp.com", "doctor.healthapp.com"]
  },
  {
    id: "p5",
    name: "Smart Home IoT",
    platform: "Intigriti",
    type: "Public",
    payouts: { critical: "€8,000", high: "€3,000", medium: "€800", low: "€100" },
    responseRate: "78%",
    difficulty: "Medium",
    competition: "Low",
    tags: ["IoT", "Hardware", "Web"],
    scope: ["*.smarthome.io", "firmware.smarthome.io"]
  },
  {
    id: "p6",
    name: "E-Commerce Startup",
    platform: "Bugcrowd",
    type: "Public",
    payouts: { critical: "$3,000", high: "$1,000", medium: "$300", low: "$50" },
    responseRate: "99%",
    difficulty: "Easy",
    competition: "Low",
    tags: ["Retail", "Web"],
    scope: ["shop.startup.com", "checkout.startup.com"]
  },
  {
    id: "p7",
    name: "Crypto Exchange X",
    platform: "HackerOne",
    type: "Public",
    payouts: { critical: "$50,000", high: "$15,000", medium: "$5,000", low: "$1,000" },
    responseRate: "80%",
    difficulty: "Very Hard",
    competition: "High",
    tags: ["Crypto", "Web", "Smart Contract"],
    scope: ["exchange.crypto.com", "api.crypto.com", "wallet.crypto.com"]
  },
  {
    id: "p8",
    name: "Local Govt Portal",
    platform: "Self-Hosted",
    type: "VDP",
    payouts: { critical: "Swag", high: "Swag", medium: "Swag", low: "Swag" },
    responseRate: "60%",
    difficulty: "Easy",
    competition: "Low",
    tags: ["Gov", "Web", "Wide Scope"],
    scope: ["*.city.gov", "portal.city.gov"]
  }
];
