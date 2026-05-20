import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function makeRef() {
  return `CDV-PIX-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const required = [
      "payer_name",
      "payer_document",
      "payer_email",
      "payer_phone",
      "unit_name",
      "checkin",
      "checkout",
      "guests_count",
      "guests"
    ];

    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ error: `Missing field: ${field}` });
      }
    }

    if (!body.policy_accepted || !body.payer_declaration_accepted) {
      return res.status(400).json({
        error: "Declarations must be accepted"
      });
    }

    const booking_reference = makeRef();

    const payload = {
      booking_reference,
      source: "whatsapp",
      status: "pending_pix",

      payer_name: body.payer_name,
      payer_document: body.payer_document,
      payer_email: body.payer_email,
      payer_phone: body.payer_phone,

      unit_name: body.unit_name,
      checkin: body.checkin,
      checkout: body.checkout,
      guests_count: Number(body.guests_count || 1),
      guests: body.guests,
      children: body.children || null,
      notes: body.notes || null,

      policy_accepted: Boolean(body.policy_accepted),
      payer_declaration_accepted: Boolean(body.payer_declaration_accepted)
    };

    const { data, error } = await supabase
      .from("pix_booking_requests")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      booking_reference,
      data
    });
  } catch (err) {
    console.error("pre-booking error:", err);
    return res.status(500).json({
      error: "Internal error",
      message: err.message
    });
  }
}