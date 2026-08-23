import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, body, sendMode } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      // Mock mode — no real email sent, return a fake delivery ID
      const deliveryId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      return new Response(
        JSON.stringify({
          success: true,
          deliveryId,
          status: "mock_sent",
          message: `Mock send to ${to} (${sendMode || 'test'} mode) — no RESEND_API_KEY configured`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Live Resend API call
    // Phase 2: SMS (Twilio) and Teams (Microsoft Graph) delivery are out of scope for this prototype.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DELCA VisionTech <events@delcavisiontech.com>",
        to: [to],
        subject: sendMode === "test" ? `[TEST] ${subject}` : subject,
        text: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(
        JSON.stringify({ error: `Resend API error: ${error}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        deliveryId: data.id,
        status: "sent",
        message: `Email sent to ${to}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
