/**
 * Built-in example templates for common WebMCP tool archetypes.
 *
 * Each template is a complete TypeScript source string that can be
 * written to a file and then fed to webmcp-gen for generation.
 */

export interface Template {
  name: string;
  description: string;
  filename: string;
  content: string;
}

export const TEMPLATES: Template[] = [
  {
    name: "crud-api",
    description: "CRUD operations for a resource (create, read, update, delete)",
    filename: "crud-api.ts",
    content: `// CRUD API — WebMCP tool template
//
// A typical four-operation CRUD interface for managing items.
// Run: webmcp-gen --api crud-api.ts

/** Create a new item in the catalog. */
interface CreateItem {
  /** Display name for the item. */
  name: string;
  /** Longer description text. */
  description: string;
  /** Price in USD cents (e.g. 1999 = $19.99). */
  priceInCents: number;
  /** Category slug. */
  category: "electronics" | "clothing" | "home" | "other";
  /** Optional tags for search. */
  tags?: string[];
}

/**
 * Retrieve an item by ID.
 * @readonly
 */
interface GetItem {
  /** The unique item identifier. */
  itemId: string;
}

/** Update an existing item (partial update). */
interface UpdateItem {
  /** The unique item identifier. */
  itemId: string;
  /** New name (optional). */
  name?: string;
  /** New description (optional). */
  description?: string;
  /** New price in USD cents (optional). */
  priceInCents?: number;
  /** New category (optional). */
  category?: "electronics" | "clothing" | "home" | "other";
}

/** Delete an item by ID. */
interface DeleteItem {
  /** The unique item identifier. */
  itemId: string;
  /** If true, permanently delete instead of soft-delete. */
  hard?: boolean;
}
`,
  },
  {
    name: "search",
    description: "Search/filter interface with pagination and sorting",
    filename: "search.ts",
    content: `// Search — WebMCP tool template
//
// A faceted search interface with pagination, filters, and sorting.
// Run: webmcp-gen --api search.ts

/**
 * Search products by keyword with optional filters.
 * @readonly
 */
interface SearchProducts {
  /** The search query string. */
  query: string;
  /** Filter by category. */
  category?: "all" | "electronics" | "clothing" | "home" | "books";
  /** Minimum price in USD. */
  minPrice?: number;
  /** Maximum price in USD. */
  maxPrice?: number;
  /** Sort order. */
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest";
  /** Page number (1-indexed). */
  page?: number;
  /** Results per page (max 100). */
  pageSize?: number;
  /** Only include items currently in stock. */
  inStockOnly?: boolean;
}
`,
  },
  {
    name: "form-handler",
    description: "Form submission handler (contact form, booking, etc.)",
    filename: "form-handler.ts",
    content: `// Form Handler — WebMCP tool template
//
// Contact form and booking form submission handlers.
// Run: webmcp-gen --api form-handler.ts

/** Submit a contact form enquiry. */
interface SubmitContactForm {
  /** Full name of the person submitting. */
  name: string;
  /** Email address for reply. */
  email: string;
  /** Subject line. */
  subject: string;
  /** Message body (max 5000 characters). */
  message: string;
  /** Enquiry type. */
  type: "general" | "support" | "sales" | "partnership";
  /** Optional phone number. */
  phone?: string;
}

/** Book an appointment slot. */
interface BookAppointment {
  /** Preferred date (ISO 8601 format, e.g. 2026-07-15). */
  date: string;
  /** Preferred time slot. */
  timeSlot: "09:00" | "10:00" | "11:00" | "13:00" | "14:00" | "15:00" | "16:00";
  /** Service type requested. */
  service: "consultation" | "demo" | "onboarding" | "review";
  /** Name of the attendee. */
  attendeeName: string;
  /** Email for confirmation. */
  attendeeEmail: string;
  /** Optional notes for the meeting. */
  notes?: string;
}
`,
  },
  {
    name: "data-transformer",
    description: "Data transformation/conversion tool (format, convert, calculate)",
    filename: "data-transformer.ts",
    content: `// Data Transformer — WebMCP tool template
//
// Tools for converting, formatting, and calculating data.
// Run: webmcp-gen --api data-transformer.ts

/**
 * Convert a monetary amount between currencies.
 * @readonly
 */
interface ConvertCurrency {
  /** Amount to convert. */
  amount: number;
  /** Source currency (ISO 4217 code). */
  fromCurrency: string;
  /** Target currency (ISO 4217 code). */
  toCurrency: string;
}

/**
 * Format a date string according to the specified pattern.
 * @readonly
 */
interface FormatDate {
  /** Input date (ISO 8601 or Unix timestamp). */
  input: string;
  /** Output format. */
  format: "iso" | "us" | "eu" | "relative" | "unix";
  /** IANA timezone (e.g. "Europe/London"). */
  timezone?: string;
}

/**
 * Generate a summary/digest of the given text.
 * @readonly
 */
interface SummariseText {
  /** The text to summarise. */
  text: string;
  /** Maximum number of sentences in the summary. */
  maxSentences?: number;
  /** Output style. */
  style?: "bullet_points" | "paragraph" | "headline";
}
`,
  },
];

/**
 * Get a template by name.
 */
export function getTemplate(name: string): Template | undefined {
  return TEMPLATES.find((t) => t.name === name);
}

/**
 * List all available template names.
 */
export function listTemplateNames(): string[] {
  return TEMPLATES.map((t) => t.name);
}
