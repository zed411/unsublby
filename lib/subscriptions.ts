export type SubscriptionStatus = "ready" | "needs-login" | "removed";

export type Subscription = {
  id: string;
  name: string;
  category: "Paid" | "Newsletter" | "Notifications";
  source: string;
  lastSeen: string;
  confidence: number;
  status: SubscriptionStatus;
  action: string;
  link: string;
  plan: string;
  foundBy: string;
  saved?: boolean;
};

export const previewSubscriptions: Subscription[] = [
  {
    id: "streamwave",
    name: "StreamWave",
    category: "Paid",
    source: "Receipt found 3 days ago",
    lastSeen: "May 16, 2026",
    confidence: 96,
    status: "ready",
    action: "One-click unsubscribe available",
    link: "https://example.com/streamwave/manage-subscription",
    plan: "Monthly video streaming plan",
    foundBy: "Payment receipt and account update emails"
  },
  {
    id: "daily-deals",
    name: "Daily Deals Club",
    category: "Newsletter",
    source: "Unsubscribe footer found",
    lastSeen: "May 18, 2026",
    confidence: 91,
    status: "ready",
    action: "Marketing email opt-out",
    link: "https://example.com/daily-deals/preferences",
    plan: "Retail discount newsletter",
    foundBy: "Marketing footer with unsubscribe link"
  },
  {
    id: "cloudbox",
    name: "CloudBox Storage",
    category: "Paid",
    source: "Renewal reminder found",
    lastSeen: "May 10, 2026",
    confidence: 88,
    status: "needs-login",
    action: "Account login required",
    link: "https://example.com/cloudbox/account/billing",
    plan: "Cloud storage billing account",
    foundBy: "Renewal reminder and invoice emails"
  },
  {
    id: "fitpulse",
    name: "FitPulse",
    category: "Notifications",
    source: "Weekly progress alert",
    lastSeen: "May 12, 2026",
    confidence: 82,
    status: "ready",
    action: "Notification preferences link",
    link: "https://example.com/fitpulse/notifications",
    plan: "Fitness progress notifications",
    foundBy: "Weekly progress alerts"
  },
  {
    id: "jobboard",
    name: "JobBoard Alerts",
    category: "Notifications",
    source: "Saved search email",
    lastSeen: "May 17, 2026",
    confidence: 93,
    status: "ready",
    action: "Stop email alerts",
    link: "https://example.com/jobboard/alerts",
    plan: "Saved job search alerts",
    foundBy: "Recurring job match emails"
  },
  {
    id: "mealcrate",
    name: "MealCrate",
    category: "Paid",
    source: "Delivery update found",
    lastSeen: "May 8, 2026",
    confidence: 79,
    status: "needs-login",
    action: "Cancellation page needs login",
    link: "https://example.com/mealcrate/subscription",
    plan: "Meal delivery subscription",
    foundBy: "Delivery updates and billing messages"
  }
];

export const deepSearchSubscriptions: Subscription[] = [
  {
    id: "skillforge",
    name: "SkillForge Courses",
    category: "Paid",
    source: "Course receipt found",
    lastSeen: "May 6, 2026",
    confidence: 84,
    status: "needs-login",
    action: "Membership page needs login",
    link: "https://example.com/skillforge/membership",
    plan: "Online learning membership",
    foundBy: "Older receipts and course update emails"
  },
  {
    id: "newsflash",
    name: "NewsFlash Briefing",
    category: "Newsletter",
    source: "Morning digest found",
    lastSeen: "May 4, 2026",
    confidence: 89,
    status: "ready",
    action: "Digest unsubscribe available",
    link: "https://example.com/newsflash/unsubscribe",
    plan: "Daily news briefing",
    foundBy: "Recurring digest email"
  },
  {
    id: "gamevault",
    name: "GameVault Plus",
    category: "Paid",
    source: "Trial reminder found",
    lastSeen: "April 29, 2026",
    confidence: 77,
    status: "needs-login",
    action: "Trial cancellation needs login",
    link: "https://example.com/gamevault/subscription",
    plan: "Game subscription trial",
    foundBy: "Trial ending and billing reminder emails"
  },
  {
    id: "shopwatch",
    name: "ShopWatch Price Alerts",
    category: "Notifications",
    source: "Price drop alert found",
    lastSeen: "April 27, 2026",
    confidence: 86,
    status: "ready",
    action: "Alert settings link",
    link: "https://example.com/shopwatch/alerts",
    plan: "Saved shopping alerts",
    foundBy: "Price drop notification emails"
  },
  {
    id: "travelnest",
    name: "TravelNest Deals",
    category: "Newsletter",
    source: "Travel promo found",
    lastSeen: "April 21, 2026",
    confidence: 81,
    status: "ready",
    action: "Promo email opt-out",
    link: "https://example.com/travelnest/preferences",
    plan: "Travel deals newsletter",
    foundBy: "Promotional travel email footer"
  },
  {
    id: "budgetbee",
    name: "BudgetBee Reports",
    category: "Notifications",
    source: "Monthly report found",
    lastSeen: "April 18, 2026",
    confidence: 83,
    status: "ready",
    action: "Report emails can be disabled",
    link: "https://example.com/budgetbee/reports",
    plan: "Monthly finance report emails",
    foundBy: "Recurring monthly report notification"
  }
];

export function createPreviewList() {
  return previewSubscriptions.map((subscription) => ({ ...subscription, saved: false }));
}

export function createFullList() {
  return [...previewSubscriptions, ...deepSearchSubscriptions].map((subscription) => ({
    ...subscription,
    saved: false
  }));
}
