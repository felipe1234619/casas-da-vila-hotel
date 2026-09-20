// Run: node --experimental-vm-modules --test tests/booking-integrity.test.js
// Actual handler source, isolated ESM imports. No SDK/network access is possible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const holdId = '11111111-1111-4111-8111-111111111111';
function makeHold(overrides = {}) {
  return { id: holdId, unit_id: '22222222-2222-4222-8222-222222222222',
    guest_name: 'Test Guest', guest_email: 'guest@example.test', guest_phone: null,
    check_in: '2027-03-01', check_out: '2027-03-08', guests_count: 2,
    amount_total: '644.00', currency: 'BRL', status: 'held',
    expires_at: new Date(Date.now() + 900000).toISOString(), special_requests: null,
    unit: { slug: 'casa-oca', name: 'Casa Oca', active: true }, ...overrides };
}
function payload(overrides = {}) {
  return { holdId, unitSlug: 'casa-oca', unitName: 'Untrusted display name',
    checkIn: '2027-03-01', checkOut: '2027-03-08', guestsCount: 2,
    guestName: 'Client name', guestEmail: ' GUEST@example.test ', amountTotal: '644.00',
    successPath: '/pt/sucesso/?guest=Client', ...overrides };
}
function event(overrides = {}) {
  return { type: 'checkout.session.completed', data: { object: {
    id: 'cs_test_valid', payment_intent: 'pi_test_valid', payment_status: 'paid',
    mode: 'payment', amount_total: 64400, currency: 'brl', created: Math.floor(Date.now()/1000),
    client_reference_id: holdId,
    metadata: { hold_id: holdId, booking_reference: 'CDV-TEST', locale: 'pt' }, ...overrides } } };
}
async function loadHandler(path, options = {}) {
  const calls = { stripe: [], rpc: [], inserts: [], effects: [], network: [] };
  const sessions = new Map();
  const confirmations = new Map();
  const sb = {
    from(table) {
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: options.hold === null ? null : options.hold || makeHold(), error: options.holdError || null }; },
        async insert(row) { calls.inserts.push({table,row}); return { error: null }; }
      };
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (options.rpcError) return { data: null, error: { message: options.rpcError } };
      // Simulated transaction for handler retry tests; actual DB invariants are in tests/sql.
      const duplicate = confirmations.has(args.p_stripe_session_id);
      const reservation = confirmations.get(args.p_stripe_session_id) || {
        id: 'reservation-test', hold_id: holdId, booking_reference: args.p_booking_reference,
        stripe_session_id: args.p_stripe_session_id, guest_name: 'Canonical Guest',
        guest_email: 'guest@example.test', unit_slug: 'casa-oca', unit_name: 'Casa Oca',
        checkin: '2027-03-01', checkout: '2027-03-08', guests_count: 2,
        amount_total: args.p_paid_amount_cents, currency: args.p_currency
      };
      confirmations.set(args.p_stripe_session_id, reservation);
      return { data: { duplicate, reservation, nights: 7 }, error: null };
    },
    storage: { from() { return { async upload() { calls.effects.push('upload'); return { error: null }; } }; } }
  };
  class Stripe {
    checkout = { sessions: { create: async (params, opts) => {
      calls.stripe.push({ params, opts });
      const existing = sessions.get(opts.idempotencyKey);
      if (existing) assert.equal(JSON.stringify(existing.params), JSON.stringify(params));
      const session = existing?.session || { id: 'cs_test_mock', url: 'https://checkout.example.test/mock' };
      sessions.set(opts.idempotencyKey, { params, session });
      return session;
    } } };
    webhooks = { constructEvent(raw, signature) {
      calls.effects.push('signature');
      assert.equal(raw.toString(), 'signed raw body');
      if (signature !== 'valid') throw new Error('bad signature');
      return options.event || event();
    } };
  }
  const context = vm.createContext({
    Buffer, URLSearchParams, URL, Date, Intl, console: { info() {}, warn() {}, error() {} },
    process: { env: { STRIPE_SECRET_KEY: 'test-placeholder', STRIPE_WEBHOOK_SECRET: 'test-placeholder',
      SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-placeholder',
      RESEND_API_KEY: 'test-placeholder', SITE_URL: 'https://hotel.example.test' } },
    fetch: async (url) => {
      calls.network.push(url); // Always a fake. Unexpected paths fail, never fall through.
      assert.ok(url.startsWith('https://db.example.test/rest/v1/booking_vouchers?') || url === 'https://api.resend.com/emails');
      if (options.emailError && url === 'https://api.resend.com/emails') throw new Error('Email failure');
      return { ok: true, text: async () => '{}' };
    }
  });
  const exportsByModule = {
    stripe: { default: Stripe }, '@supabase/supabase-js': { createClient: () => sb },
    '@sparticuz/chromium': { default: { args: [], executablePath: async () => '/mock/chromium' } },
    'puppeteer-core': { default: { launch: async () => {
      calls.effects.push('pdf');
      if (options.pdfError) throw new Error('PDF failure');
      return { newPage: async () => ({ setContent: async () => {}, pdf: async () => Buffer.from('pdf') }), close: async () => {} };
    } } }
  };
  const module = new vm.SourceTextModule(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'), { context });
  await module.link(async specifier => {
    const entries = exportsByModule[specifier];
    assert.ok(entries, `Unexpected dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(entries), function () {
      for (const [key, value] of Object.entries(entries)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  async function invoke(body = {}, signature = 'valid') {
    const req = { method: 'POST', body, headers: { host: 'hotel.example.test', 'stripe-signature': signature },
      async *[Symbol.asyncIterator]() { yield Buffer.from('signed raw body'); } };
    const res = { code: 200, status(code) { this.code = code; return this; },
      json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
    await module.namespace.default(req, res);
    return res;
  }
  return { invoke, calls };
}
const checkout = opts => loadHandler('server/booking/checkout-handler.js', opts);
const webhook = opts => loadHandler('api/stripe-webhook.js', opts);

test('checkout uses canonical price, identity and BRL with current PT payload', async () => {
  const h = await checkout(); const res = await h.invoke(payload());
  assert.equal(res.code, 200);
  const p = h.calls.stripe[0].params;
  assert.equal(p.line_items[0].price_data.unit_amount, 64400);
  assert.equal(p.line_items[0].price_data.currency, 'brl');
  assert.equal(p.metadata.guest_name, 'Test Guest');
  assert.equal(p.metadata.unit_name, 'Casa Oca');
  assert.match(p.success_url, /\/pt\/sucesso\//);
  assert.match(p.success_url, /ref=CDV-/);
});
test('EN and legacy field aliases remain accepted', async () => {
  const h = await checkout();
  const body = payload({ holdId: undefined, hold_id: holdId, amountTotal: undefined, amount_total: 644,
    successPath: '/en/success/' });
  assert.equal((await h.invoke(body)).code, 200);
  assert.match(h.calls.stripe[0].params.success_url, /\/en\/success\//);
});
for (const amount of ['1', '645', '644.001', '644,00', 'R$ 644', '1e3', '', null, -1, 0, Infinity, {}, '21474836.48']) {
  test(`checkout rejects invalid/manipulated amount ${String(amount)}`, async () => {
    const h = await checkout(); assert.equal((await h.invoke(payload({ amountTotal: amount }))).code, 409);
    assert.equal(h.calls.stripe.length, 0);
  });
}
for (const [name, hold] of [
  ['missing', null], ['expired', makeHold({ expires_at: new Date(0).toISOString() })],
  ['invalid expiry', makeHold({ expires_at: 'invalid' })], ['converted', makeHold({ status: 'converted' })],
  ['inactive unit', makeHold({ unit: { active: false } })],
  ['bad canonical amount', makeHold({ amount_total: 'NaN' })], ['bad currency', makeHold({ currency: 'USD' })]
]) test(`checkout rejects ${name} hold`, async () => {
  const h = await checkout({ hold }); assert.equal((await h.invoke(payload())).code, 409);
  assert.equal(h.calls.stripe.length, 0);
});
for (const mismatch of [{ currency: 'usd' }, { unitSlug: 'other' }, { checkIn: '2027-03-02' },
  { checkOut: '2027-03-09' }, { guestsCount: 3 }, { guestsCount: 2.5 }, { guestEmail: 'other@example.test' }]) {
  test(`checkout rejects ${Object.keys(mismatch)[0]} mismatch`, async () => {
    const h = await checkout(); assert.equal((await h.invoke(payload(mismatch))).code, 409);
    assert.equal(h.calls.stripe.length, 0);
  });
}
test('invalid UUID and database failure never reach Stripe', async () => {
  const h = await checkout({ holdError: { message: 'offline' } });
  assert.equal((await h.invoke(payload({ holdId: 'bad' }))).code, 400);
  assert.equal((await h.invoke(payload())).code, 500); assert.equal(h.calls.stripe.length, 0);
});
test('simultaneous checkout retries have identical idempotent Stripe parameters', async () => {
  const h = await checkout(); const results = await Promise.all([h.invoke(payload()), h.invoke(payload())]);
  assert.ok(results.every(r => r.code === 200));
  assert.equal(h.calls.stripe[0].opts.idempotencyKey, h.calls.stripe[1].opts.idempotencyKey);
});
test('signature is checked before any confirmation', async () => {
  const h = await webhook(); assert.equal((await h.invoke({}, 'invalid')).code, 400);
  assert.equal(h.calls.rpc.length, 0);
});
test('unpaid event is acknowledged without confirmation or voucher', async () => {
  const h = await webhook({ event: event({ payment_status: 'unpaid' }) });
  assert.equal((await h.invoke()).code, 200); assert.equal(h.calls.rpc.length, 0);
  assert.deepEqual(h.calls.effects, ['signature']);
});
for (const fields of [{ amount_total: undefined }, { amount_total: 0 }, { amount_total: '64400' },
  { amount_total: 64400.5 }, { currency: undefined }, { id: 'invalid' }, { payment_intent: null },
  { created: null }, { client_reference_id: 'different' }, { metadata: { amount_total_cents: '64400' } }]) {
  test(`webhook rejects invalid ${Object.keys(fields)[0]} without metadata financial fallback`, async () => {
    const h = await webhook({ event: event(fields) }); assert.equal((await h.invoke()).code, 400);
    assert.equal(h.calls.rpc.length, 0);
  });
}
test('paid session uses transactional RPC and only canonical reservation for voucher', async () => {
  const h = await webhook(); assert.equal((await h.invoke()).code, 200);
  assert.equal(h.calls.rpc[0].name, 'confirm_paid_reservation_from_hold');
  assert.equal(h.calls.rpc[0].args.p_paid_amount_cents, 64400);
  assert.ok(h.calls.effects.includes('pdf')); assert.equal(h.calls.inserts.length, 0);
});
test('repeated and concurrent webhook deliveries emit side effects only once', async () => {
  const h = await webhook(); const r = await Promise.all([h.invoke(), h.invoke()]);
  assert.ok(r.every(x => x.code === 200)); assert.equal(r.filter(x => x.body.duplicate).length, 1);
  assert.equal(h.calls.effects.filter(x => x === 'pdf').length, 1);
  assert.equal(h.calls.network.filter(x => x === 'https://api.resend.com/emails').length, 1);
});
test('RPC price/currency/conflict error stays retryable and emits no voucher', async () => {
  const h = await webhook({ rpcError: 'canonical mismatch' }); assert.equal((await h.invoke()).code, 500);
  assert.equal(h.calls.effects.includes('pdf'), false);
});
test('PDF failure does not undo a committed reservation; duplicate remains safe', async () => {
  const h = await webhook({ pdfError: true }); assert.equal((await h.invoke()).code, 200);
  assert.equal((await h.invoke()).body.duplicate, true); assert.equal(h.calls.inserts.length, 0);
});

test('canonical cent conversion is exact without rounding floating point inputs', async () => {
  const h = await checkout({ hold: makeHold({ amount_total: '644.29' }) });
  assert.equal((await h.invoke(payload({ amountTotal: '644.29' }))).code, 200);
  assert.equal(h.calls.stripe[0].params.line_items[0].price_data.unit_amount, 64429);
});
test('email failure cannot undo confirmation or generate another reservation', async () => {
  const h = await webhook({ emailError: true });
  assert.equal((await h.invoke()).code, 200);
  assert.equal((await h.invoke()).body.duplicate, true);
});
test('async paid event is validated through same RPC; unrelated events are ignored', async () => {
  const paid = event(); paid.type = 'checkout.session.async_payment_succeeded';
  const h = await webhook({ event: paid }); assert.equal((await h.invoke()).code, 200);
  assert.equal(h.calls.rpc.length, 1);
  const unrelated = event(); unrelated.type = 'customer.created';
  const other = await webhook({ event: unrelated }); assert.equal((await other.invoke()).code, 200);
  assert.equal(other.calls.rpc.length, 0);
});
