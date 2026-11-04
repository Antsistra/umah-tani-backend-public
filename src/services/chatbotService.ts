import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

interface UserContext {
  location?: string;
}

interface ChatbotAskInput {
  message: string;
  session_id?: string;
  user_context?: UserContext;
}

interface ChatTurn {
  role: "user" | "assistant";
  message: string;
  at: number;
}

interface SessionMemoryState {
  turns: ChatTurn[];
  last_touched_at: number;
  pending_clarification?: string;
}

interface ProductCategory {
  name?: string;
  slug?: string;
}

interface ProductContext {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  unit: string;
  stock_quantity: number;
  category?: ProductCategory | null;
}

interface ModelRecommendedProduct {
  product_id?: string;
  name?: string;
  price?: number;
  unit?: string;
}

interface ModelOutput {
  answer?: string;
  recommended_products?: ModelRecommendedProduct[];
  follow_up_question?: string;
  disclaimer?: string;
}

type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "NULL";
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  nullable?: boolean;
};

interface ChatbotAskResult {
  answer: string;
  recommended_products: Array<{
    product_id: string;
    name: string;
    price: number;
    unit: string;
  }>;
  follow_up_question: string | null;
  disclaimer: string | null;
  in_domain: boolean;
  needs_clarification: boolean;
  clarification_question: string | null;
  guardrail: {
    prefilter: "pass" | "blocked" | "clarify";
    postfilter: "pass" | "corrected";
  };
}

const AGRI_KEYWORDS = [
  "pertanian",
  "petani",
  "agribisnis",
  "pupuk",
  "hama",
  "panen",
  "irigasi",
  "tanaman",
  "budidaya",
  "benih",
  "bibit",
  "kompos",
  "perikanan",
  "ikan",
  "lele",
  "nila",
  "udang",
  "tambak",
  "pakan",
  "kolam",
  "hidroponik",
  "organik",
  "insektisida",
  "fungisida",
  "gulma",
  "sawah",
  "ladang",
  "cabai",
  "jagung",
  "padi",
  "nutrisi",
  "defisiensi",
  "unsur hara",
  "hara",
  "mikro nutrien",
  "makro nutrien",
  "fase vegetatif",
  "fase generatif",
  "pemupukan",
  "pemeliharaan",
  // Komoditas tanaman umum
  "kopi",
  "teh",
  "kelapa",
  "sawit",
  "kakao",
  "coklat",
  "durian",
  "mangga",
  "jeruk",
  "pisang",
  "semangka",
  "melon",
  "karet",
  "tebu",
  "singkong",
  "kentang",
  "bawang",
  "kedelai",
  "kacang",
  "wortel",
  "sawi",
  "bayam",
  "kangkung",
  "selada",
  "terong",
  "timun",
  "mentimun",
  "labu",
  "stroberi",
  "anggur",
  "tomat",
  // Media tanam dan infrastruktur
  "tanah",
  "lahan",
  "media tanam",
  "greenhouse",
  "rumah kaca",
  "polybag",
  "pot",
  // Aktivitas pertanian
  "tanam",
  "bertani",
  "bercocok tanam",
  "cocok tanam",
  "pengairan",
  "drainase",
  "fermentasi",
  "pascapanen",
  "pasca panen",
  "pengolahan",
  "hasil tani",
  "tanah",
  "nanam",
  "hasil panen",
];

const OUT_OF_DOMAIN_HINTS = [
  "politik",
  "presiden",
  "kampanye",
  "sepak bola",
  "film",
  "artis",
  "bitcoin",
  "saham",
  "kripto",
  "coding",
  "javascript",
  "python",
  "hacking",
  "jailbreak",
  "game",
  "drama korea",
];

const PRODUCT_INTENT_KEYWORDS = [
  "rekomendasi produk",
  "rekomendasi",
  "produk",
  "beli",
  "harga",
  "stok",
  "murah",
  "hemat",
  "ekonomis",
  "paket",
  "pupuk",
  "pakan",
  "vitamin",
  "obat",
  "benih",
  "bibit",
];

const STOPWORDS = new Set([
  "yang",
  "dan",
  "atau",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "ini",
  "itu",
  "apa",
  "bagaimana",
  "agar",
  "supaya",
  "saya",
  "aku",
  "kami",
  "kita",
  "mau",
  "ingin",
  "tolong",
  "dong",
  "ya",
  "nih",
  "yang",
]);

const MAX_SESSION_TURNS = 6;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const sessionMemory = new Map<string, SessionMemoryState>();

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsAnyKeyword = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const sanitizeSessionId = (sessionId?: string): string | null => {
  if (!sessionId) return null;
  const value = sessionId.trim();
  if (!value) return null;
  return value.slice(0, 120);
};

const cleanupExpiredSessions = (): void => {
  const now = Date.now();
  for (const [id, state] of sessionMemory.entries()) {
    if (now - state.last_touched_at > SESSION_TTL_MS) {
      sessionMemory.delete(id);
    }
  }
};

const getSessionHistory = (sessionId?: string): ChatTurn[] => {
  const sanitized = sanitizeSessionId(sessionId);
  if (!sanitized) return [];

  cleanupExpiredSessions();
  const state = sessionMemory.get(sanitized);
  if (!state) return [];

  state.last_touched_at = Date.now();
  return state.turns.slice(-MAX_SESSION_TURNS);
};

const appendSessionTurns = (sessionId: string | undefined, turns: ChatTurn[]): void => {
  const sanitized = sanitizeSessionId(sessionId);
  if (!sanitized || turns.length === 0) return;

  cleanupExpiredSessions();
  const now = Date.now();
  const existing = sessionMemory.get(sanitized);
  const merged = [
    ...(existing?.turns || []),
    ...turns.map((turn) => ({ ...turn, at: turn.at || now })),
  ].slice(-MAX_SESSION_TURNS);

  sessionMemory.set(sanitized, {
    turns: merged,
    last_touched_at: now,
    pending_clarification: existing?.pending_clarification,
  });
};

type DomainCheckResult = "in_domain" | "ambiguous" | "out_of_domain";

const isAgribusinessQuestion = (
  message: string,
  userContext?: UserContext,
  recentHistory: ChatTurn[] = []
): DomainCheckResult => {
  const normalized = normalizeText(message);
  const historyText = normalizeText(recentHistory.map((turn) => turn.message).join(" "));

  // Explicit out-of-domain → langsung tolak
  if (containsAnyKeyword(normalized, OUT_OF_DOMAIN_HINTS)) {
    return "out_of_domain";
  }

  // Explicit in-domain keyword → langsung lolos
  if (containsAnyKeyword(normalized, AGRI_KEYWORDS)) {
    return "in_domain";
  }

  // Ada konteks agribisnis di history → anggap lanjutan
  const hasAgricultureHistory = historyText
    ? containsAnyKeyword(historyText, AGRI_KEYWORDS)
    : false;

  if (hasAgricultureHistory && normalized.length >= 2) {
    return "in_domain";
  }

  // Tidak match apapun → ambigu, perlu klarifikasi
  return "ambiguous";
};

const hasProductIntent = (message: string, userContext?: UserContext): boolean => {
  const normalized = normalizeText(message);
  return containsAnyKeyword(normalized, PRODUCT_INTENT_KEYWORDS);
};

const extractKeywords = (message: string, userContext?: UserContext): string[] => {
  const normalized = normalizeText(message);

  return normalized
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .slice(0, 10);
};

const rankProducts = (products: ProductContext[], keywords: string[]): ProductContext[] => {
  if (keywords.length === 0) return products;

  const scored = products.map((product) => {
    const haystack = normalizeText(
      [
        product.name,
        product.description || "",
        product.category?.name || "",
        product.category?.slug || "",
      ].join(" ")
    );

    let score = 0;
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 2;
      }
      if (normalizeText(product.name).includes(keyword)) {
        score += 3;
      }
    }

    return { product, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);
};

const fetchRelevantProducts = async (
  message: string,
  userContext?: UserContext,
  limit = 8
): Promise<ProductContext[]> => {
  const keywords = extractKeywords(message, userContext);

  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      description,
      price,
      unit,
      stock_quantity,
      is_available,
      created_at,
      category:product_categories(name, slug)
    `
    )
    .eq("is_available", true)
    .gt("stock_quantity", 0)
    .limit(80);

  if (error) {
    throw new AppError(`Failed to fetch product context: ${error.message}`, 500);
  }

  const products = (data || []) as ProductContext[];
  const ranked = rankProducts(products, keywords);

  return ranked.slice(0, limit);
};

const buildSystemInstruction = (): string => {
  return [
    "Kamu adalah asisten agribisnis untuk pertanian dan perikanan.",
    "Batas topik: pertanian, perikanan, budidaya, pupuk, hama, panen, pakan, hasil tani/ikan, dan produk agribisnis.",
    "Jika user bertanya di luar domain tersebut, tolak dengan sopan dan arahkan kembali ke topik agribisnis.",
    "Jika merekomendasikan produk, WAJIB hanya dari PRODUCT_CONTEXT yang diberikan.",
    "Dilarang menyebut produk di luar context.",
    "Jika data belum cukup, ajukan follow-up question singkat.",
    "Output wajib JSON valid tanpa markdown sesuai schema yang diminta user prompt.",
  ].join(" ");
};

const buildUserPrompt = (
  message: string,
  products: ProductContext[],
  userContext?: UserContext,
  recentHistory: ChatTurn[] = []
): string => {
  const compactProducts = products.map((p) => ({
    product_id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    unit: p.unit,
    stock_quantity: p.stock_quantity,
    category_name: p.category?.name || null,
  }));

  const compactHistory = recentHistory.map((turn) => ({
    role: turn.role,
    message: turn.message,
  }));

  return [
    "Balas dalam JSON dengan format:",
    '{"answer":"string","recommended_products":[{"product_id":"string","name":"string","price":number,"unit":"string"}],"follow_up_question":"string|null","disclaimer":"string|null"}',
    "Jangan sertakan field lain.",
    "Gunakan RECENT_CHAT_CONTEXT untuk memahami konteks pertanyaan lanjutan.",
    `USER_CONTEXT: ${JSON.stringify(userContext || {})}`,
    `RECENT_CHAT_CONTEXT: ${JSON.stringify(compactHistory)}`,
    `PRODUCT_CONTEXT: ${JSON.stringify(compactProducts)}`,
    `USER_MESSAGE: ${message}`,
  ].join("\n");
};

const extractModelText = (responseJson: unknown): string => {
  if (!responseJson || typeof responseJson !== "object") return "";

  const payload = responseJson as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
};

const CHATBOT_RESPONSE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  required: ["answer", "recommended_products", "follow_up_question", "disclaimer"],
  properties: {
    answer: { type: "STRING" },
    recommended_products: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["product_id", "name", "price", "unit"],
        properties: {
          product_id: { type: "STRING" },
          name: { type: "STRING" },
          price: { type: "NUMBER" },
          unit: { type: "STRING" },
        },
      },
    },
    follow_up_question: { type: "STRING", nullable: true },
    disclaimer: { type: "STRING", nullable: true },
  },
};

const normalizeModelOutput = (value: ModelOutput): ModelOutput => {
  const answer = typeof value.answer === "string" ? value.answer.trim() : "";

  const recommendedProducts = Array.isArray(value.recommended_products)
    ? value.recommended_products
      .map((item) => ({
        product_id:
          typeof item?.product_id === "string" ? item.product_id.trim() : undefined,
        name: typeof item?.name === "string" ? item.name.trim() : undefined,
        price:
          typeof item?.price === "number"
            ? item.price
            : Number.isFinite(Number(item?.price))
              ? Number(item?.price)
              : undefined,
        unit: typeof item?.unit === "string" ? item.unit.trim() : undefined,
      }))
      .filter((item) => item.product_id || item.name)
    : [];

  const followUpQuestion =
    typeof value.follow_up_question === "string"
      ? value.follow_up_question.trim() || null
      : null;

  const disclaimer =
    typeof value.disclaimer === "string" ? value.disclaimer.trim() || null : null;

  return {
    answer,
    recommended_products: recommendedProducts,
    follow_up_question: followUpQuestion || undefined,
    disclaimer: disclaimer || undefined,
  };
};

const parseModelOutput = (rawText: string): ModelOutput => {
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  try {
    return normalizeModelOutput(JSON.parse(cleaned) as ModelOutput);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const maybeJson = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return normalizeModelOutput(JSON.parse(maybeJson) as ModelOutput);
      } catch {
        // Fallback to regex when JSON is incomplete/malformed
      }
    }

    // Regex fallback to parse incomplete/truncated JSON
    const answerRegex = /"answer"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/s;
    const match = cleaned.match(answerRegex);
    if (match && match[1]) {
      const answer = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");

      const fqRegex = /"follow_up_question"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/s;
      const fqMatch = cleaned.match(fqRegex);
      const follow_up_question = fqMatch && fqMatch[1]
        ? fqMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
        : undefined;

      const descRegex = /"disclaimer"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/s;
      const descMatch = cleaned.match(descRegex);
      const disclaimer = descMatch && descMatch[1]
        ? descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
        : undefined;

      return normalizeModelOutput({
        answer,
        follow_up_question,
        disclaimer,
        recommended_products: [],
      });
    }

    return normalizeModelOutput({ answer: cleaned, recommended_products: [] });
  }
};

const isOutputStillInDomain = (answer: string): boolean => {
  const normalized = normalizeText(answer);
  if (!normalized) return false;

  if (containsAnyKeyword(normalized, AGRI_KEYWORDS)) return true;
  if (containsAnyKeyword(normalized, OUT_OF_DOMAIN_HINTS)) return false;

  return true;
};

const postFilterOutput = (
  modelOutput: ModelOutput,
  products: ProductContext[]
): { result: ChatbotAskResult; corrected: boolean } => {
  const productMapById = new Map(products.map((p) => [p.id, p]));
  const productMapByName = new Map(
    products.map((p) => [normalizeText(p.name), p])
  );

  const rawRecommendations = Array.isArray(modelOutput.recommended_products)
    ? modelOutput.recommended_products
    : [];

  const validRecommendations: ChatbotAskResult["recommended_products"] = [];

  for (const item of rawRecommendations) {
    const byId = item.product_id ? productMapById.get(item.product_id) : undefined;
    const byName = item.name
      ? productMapByName.get(normalizeText(item.name))
      : undefined;
    const found = byId || byName;

    if (!found) continue;

    validRecommendations.push({
      product_id: found.id,
      name: found.name,
      price: found.price,
      unit: found.unit,
    });

    if (validRecommendations.length >= 5) break;
  }

  let corrected = validRecommendations.length !== rawRecommendations.length;

  if (validRecommendations.length === 0 && products.length > 0) {
    const fallbackProducts = products.slice(0, 2).map((product) => ({
      product_id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
    }));

    validRecommendations.push(...fallbackProducts);
    corrected = true;
  }

  const answer = modelOutput.answer?.trim() ||
    "Saya siap bantu topik agribisnis. Boleh jelaskan komoditas, kondisi lahan/kolam, dan target hasil kamu?";

  const inDomain = isOutputStillInDomain(answer);

  if (!inDomain) {
    corrected = true;
    return {
      corrected,
      result: {
        answer:
          "Maaf, saya hanya bisa membantu topik agribisnis (pertanian dan perikanan). Silakan tanya seputar budidaya, pupuk, hama, pakan, panen, atau produk agribisnis.",
        recommended_products: [],
        follow_up_question: null,
        disclaimer: null,
        in_domain: false,
        needs_clarification: false,
        clarification_question: null,
        guardrail: {
          prefilter: "pass",
          postfilter: "corrected",
        },
      },
    };
  }

  return {
    corrected,
    result: {
      answer,
      recommended_products: validRecommendations,
      follow_up_question: modelOutput.follow_up_question?.trim() || null,
      disclaimer: modelOutput.disclaimer?.trim() || null,
      in_domain: true,
      needs_clarification: false,
      clarification_question: null,
      guardrail: {
        prefilter: "pass",
        postfilter: corrected ? "corrected" : "pass",
      },
    },
  };
};

const callGoogleAIStudio = async (
  message: string,
  products: ProductContext[],
  userContext?: UserContext,
  recentHistory: ChatTurn[] = []
): Promise<ModelOutput> => {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  const model = process.env.GOOGLE_AI_STUDIO_MODEL || "gemini-2.0-flash";

  if (!apiKey) {
    throw new AppError("GOOGLE_AI_STUDIO_API_KEY belum dikonfigurasi", 500);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserPrompt(message, products, userContext, recentHistory) }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: CHATBOT_RESPONSE_SCHEMA,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`Google AI Studio error: ${errorText}`, 502);
  }

  const json = (await response.json()) as unknown;
  const text = extractModelText(json);

  if (!text) {
    throw new AppError("Google AI Studio tidak mengembalikan konten jawaban", 502);
  }

  return parseModelOutput(text);
};

export const askAgribusinessChatbotService = async (
  input: ChatbotAskInput
): Promise<ChatbotAskResult> => {
  const trimmedMessage = input.message.trim();
  const recentHistory = getSessionHistory(input.session_id);
  const domainCheck = isAgribusinessQuestion(
    trimmedMessage,
    input.user_context,
    recentHistory
  );

  if (domainCheck === "out_of_domain" || domainCheck === "ambiguous") {
    return {
      answer:
        "Maaf, saya fokus pada topik agribisnis (pertanian dan perikanan). Silakan tanya tentang budidaya, pupuk, hama, pakan, panen, atau produk agribisnis.",
      recommended_products: [],
      follow_up_question: null,
      disclaimer: null,
      in_domain: false,
      needs_clarification: false,
      clarification_question: null,
      guardrail: {
        prefilter: "blocked",
        postfilter: "pass",
      },
    };
  }

  const shouldFetchProducts = hasProductIntent(trimmedMessage, input.user_context);
  const products = shouldFetchProducts
    ? await fetchRelevantProducts(trimmedMessage, input.user_context, 8)
    : [];

  const modelOutput = await callGoogleAIStudio(
    trimmedMessage,
    products,
    input.user_context,
    recentHistory
  );

  const { result } = postFilterOutput(modelOutput, products);

  if (result.in_domain) {
    appendSessionTurns(input.session_id, [
      {
        role: "user",
        message: trimmedMessage,
        at: Date.now(),
      },
      {
        role: "assistant",
        message: result.answer,
        at: Date.now(),
      },
    ]);
  }

  return result;
};

export interface ChatMessageSummaryInput {
  role: "user" | "bot" | "assistant";
  text: string;
}

export const summarizeChatHistoryService = async (
  messages: ChatMessageSummaryInput[]
): Promise<string> => {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  const model = process.env.GOOGLE_AI_STUDIO_MODEL || "gemini-2.0-flash";

  if (!apiKey) {
    throw new AppError("GOOGLE_AI_STUDIO_API_KEY belum dikonfigurasi", 500);
  }

  if (!messages || messages.length === 0) {
    return "Belum ada percakapan.";
  }

  const formattedTurns = messages
    .map((msg) => {
      const roleName = msg.role === "user" ? "Petani" : "TanyaTani";
      return `${roleName}: ${msg.text.trim()}`;
    })
    .join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: {
      parts: [
        {
          text: "Anda adalah asisten dari Umah Tani. Tugas Anda adalah membuat rangkuman percakapan antara Petani dan chatbot TanyaTani secara sangat singkat dan padat (maksimal 3 kalimat). Rangkuman ini akan dibaca oleh Penyuluh Pertanian agar mereka bisa memahami inti masalah petani dengan cepat. Buat dalam Bahasa Indonesia.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Rangkum percakapan berikut ini secara singkat dan jelas (maksimal 3 kalimat):\n\n${formattedTurns}\n\nRangkuman percakapan:`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 200,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`Google AI Studio error: ${errorText}`, 502);
  }

  const json = (await response.json()) as any;
  const text = extractModelText(json);

  if (!text) {
    throw new AppError("Google AI Studio tidak mengembalikan rangkuman", 502);
  }

  return text.trim();
};
