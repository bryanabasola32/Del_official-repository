import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt, systemPrompt, schema, temperature, maxTokens } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Live Anthropic Messages API call
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens ?? 4096,
      temperature: temperature ?? 0.3,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `Anthropic API error (${response.status}): ${errorText}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";
    let structured: Record<string, unknown> | undefined;
    if (schema && content) {
      try {
        structured = JSON.parse(content);
      } catch {
        // Content is not valid JSON — leave structured undefined
      }
    }

    return new Response(
      JSON.stringify({
        content,
        structured,
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
        provider: "anthropic",
        model: data.model || DEFAULT_MODEL,
        executionTimeMs: 0,
        confidence: 0.9,
        costMetadata: {
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
