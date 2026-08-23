import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarketauxArticle {
  title: string;
  url: string;
  description: string;
  published_at: string;
  source: string;
}

interface MarketauxResponse {
  data: MarketauxArticle[];
  meta?: {
    found: number;
    returned: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { track, query, sites, maxResults } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing required field: query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("MARKETAUX_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "MARKETAUX_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams({
      api_token: apiKey,
      limit: String(maxResults || 10),
      language: "en",
    });

    if (track === "global") {
      params.set("filter_entities", "true");
      params.set("search", query);
      params.set("sort", "published_desc");
    } else if (track === "local") {
      params.set("search", query);
      params.set("sort", "published_desc");
      if (sites && sites.length > 0) {
        params.set("domains", sites.join(","));
      }
    } else {
      params.set("search", query);
      params.set("sort", "published_desc");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`https://api.marketaux.com/v1/news/all?${params}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Marketaux API error (${response.status}): ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data: MarketauxResponse = await response.json();

    const articles = (data.data || []).map((a) => ({
      title: a.title,
      url: a.url,
      snippet: a.description?.slice(0, 500) || "",
      source: a.source || extractSource(a.url),
      sourceTier: classifySource(a.url),
      publishedDate: a.published_at || new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({ articles, mock: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function extractSource(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "Unknown";
  }
}

function classifySource(url: string): 1 | 2 | 3 {
  const tier1 = ["pna.gov.ph", "mb.com.ph", "bworldonline.com", "philstar.com", "businessmirror.com.ph", "inquirer.net"];
  const hostname = url.toLowerCase();
  if (tier1.some((d) => hostname.includes(d))) return 1;
  return 2;
}

function mockArticles(query: string, max: number): Array<{
  title: string; url: string; snippet: string; source: string; sourceTier: 1 | 2 | 3; publishedDate: string;
}> {
  const articles = [];
  for (let i = 0; i < Math.min(max, 3); i++) {
    articles.push({
      title: `News article ${i + 1} about ${query}`,
      url: `https://news.example.com/${encodeURIComponent(query)}/${i}`,
      snippet: `Mock news article about ${query}. This would be a real article snippet from the news API.`,
      source: "Mock News Source",
      sourceTier: 2 as const,
      publishedDate: new Date(Date.now() - i * 86400000).toISOString(),
    });
  }
  return articles;
}
