import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_MODEL = "gemini-2.0-flash";
const MODEL_FALLBACKS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt, systemPrompt, schema, temperature, maxTokens, model } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestedModel = model || DEFAULT_MODEL;
    const modelsToTry = [requestedModel, ...MODEL_FALLBACKS.filter(m => m !== requestedModel)];

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: temperature ?? 0.3,
        maxOutputTokens: maxTokens ?? 4096,
      },
    };

    if (schema) {
      body.generationConfig.responseMimeType = "application/json";
      body.generationConfig.responseSchema = schema;
    }

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    let lastError = "";
    for (const modelName of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
            tokensUsed: data.usageMetadata?.totalTokenCount,
            provider: "gemini",
            model: modelName,
            executionTimeMs: 0,
            confidence: 0.75,
            costMetadata: {
              inputTokens: data.usageMetadata?.promptTokenCount,
              outputTokens: data.usageMetadata?.candidatesTokenCount,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      lastError = await response.text();
      // Try next model on 404 (not found) or 429 (quota exhausted)
      if (response.status !== 404 && response.status !== 429) {
        return new Response(
          JSON.stringify({
            error: `Gemini API error (${response.status}): ${lastError}`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: `Gemini API error: all models failed. Last error: ${lastError}`,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
