import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_REQUESTS = 30;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ outcome: "error" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ outcome: "error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const clientIp = getClientIp(req);

    const { data: allowed, error: rateError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_bucket_key: `check-wallet:${clientIp}`,
        p_window_seconds: RATE_WINDOW_SECONDS,
        p_max_requests: RATE_MAX_REQUESTS,
      },
    );

    if (rateError || !allowed) {
      return new Response(JSON.stringify({ outcome: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address : "";

    const { data, error } = await supabase.rpc("public_lookup_wallet", {
      p_address: address,
    });

    if (error) {
      console.error("lookup error", error);
      return new Response(JSON.stringify({ outcome: "error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-wallet error", err);
    return new Response(JSON.stringify({ outcome: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
