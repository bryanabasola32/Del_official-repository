import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  response?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, maxResults, siteScope, timeRange } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing required field: query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("TAVILY_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TAVILY_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: Record<string, unknown> = {
      api_key: apiKey,
      query,
      max_results: maxResults || 5,
      include_answer: false,
      include_raw_content: false,
    };

    if (siteScope && siteScope.length > 0) {
      body.include_domains = siteScope;
    }

    if (timeRange) {
      const days = timeRange === "day" ? 1 : timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365;
      body.days = days;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Tavily API error (${response.status}): ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data: TavilyResponse = await response.json();

    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 500) || "",
      sourceName: extractSourceName(r.url),
      sourceTier: classifySource(r.url),
      date: new Date().toISOString(),
      rawContent: undefined,
    }));

    return new Response(
      JSON.stringify({ results, mock: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function extractSourceName(url: string): string {
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
  if (hostname.includes("linkedin.com") || hostname.includes("crunchbase.com")) return 2;
  return 3;
}

function mockResults(query: string, max: number): Array<{
  title: string; url: string; snippet: string; sourceName: string; sourceTier: 1 | 2 | 3; date: string;
}> {
  const results = [];
  for (let i = 0; i < Math.min(max, 3); i++) {
    results.push({
      title: `Search result ${i + 1} for "${query}"`,
      url: `https://example.com/search/${encodeURIComponent(query)}/${i}`,
      snippet: `Mock search snippet for query "${query}". This would contain a relevant excerpt from the page content.`,
      sourceName: "Mock Search Source",
      sourceTier: 2 as const,
      date: new Date(Date.now() - i * 86400000).toISOString(),
    });
  }
  return results;
}
