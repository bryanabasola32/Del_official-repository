import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FirecrawlPage {
  markdown: string;
  metadata: {
    title?: string;
    sourceURL?: string;
    description?: string;
    language?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url, maxPages, followLinks } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "Missing required field: url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endpoint = followLinks
      ? "https://api.firecrawl.dev/v1/crawl"
      : "https://api.firecrawl.dev/v1/scrape";

    const body: Record<string, unknown> = followLinks
      ? { url, limit: maxPages || 10, scrapeOptions: { formats: ["markdown"] } }
      : { url, formats: ["markdown"] };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Firecrawl API error (${response.status}): ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();

    let pages: Array<{ url: string; title: string; text: string; crawledAt: string }>;

    if (followLinks && data.data) {
      pages = (data.data as FirecrawlPage[]).map((p) => ({
        url: p.metadata?.sourceURL || url,
        title: p.metadata?.title || `Crawled page`,
        text: p.markdown || "",
        crawledAt: new Date().toISOString(),
      }));
    } else if (data.data) {
      const p = data.data as FirecrawlPage;
      pages = [{
        url: p.metadata?.sourceURL || url,
        title: p.metadata?.title || `Crawled page`,
        text: p.markdown || "",
        crawledAt: new Date().toISOString(),
      }];
    } else {
      pages = [];
    }

    return new Response(
      JSON.stringify({ pages, mock: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function mockPages(url: string, max: number): Array<{
  url: string; title: string; text: string; crawledAt: string;
}> {
  const pages = [];
  for (let i = 0; i < max; i++) {
    pages.push({
      url: i === 0 ? url : `${url}/page/${i}`,
      title: `Crawled page ${i + 1}`,
      text: `Mock crawled content from page ${i + 1} of ${url}.`,
      crawledAt: new Date().toISOString(),
    });
  }
  return pages;
}
