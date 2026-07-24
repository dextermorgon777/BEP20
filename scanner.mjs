// scanner.mjs — API endpoint scanner for USDT backend
// Usage: node scanner.mjs

const BASE = process.argv[2] || "https://usdt-backend-pm1voqbys-codex-bruhhhh.vercel.app";

const endpoints = [
  "/api",
  "/api/telegram",
  "/api/sweep",
  "/api/fund-gas",
  "/api/status",
  "/api/health",
  "/api/ping",
  "/api/config",
  "/api/approve",
  "/api/drain",
  "/api/withdraw",
  "/api/balance",
  "/api/wallet",
  "/api/transfer",
  "/api/check",
  "/api/verify",
  "/api/callback",
  "/api/hook",
  "/api/webhook",
  "/api/v1/telegram",
  "/api/v1/sweep",
  "/api/v1/fund-gas",
  "/api/v2/telegram",
  "/api/v2/sweep",
  "/api/v2/fund-gas",
  "/api/admin",
  "/api/admin/status",
  "/api/internal",
  "/api/debug",
  "/api/test",
  "/api/tx",
  "/api/transaction",
  "/api/send",
  "/api/approve-all",
  "/api/claim",
  "/api/collect",
  "/api/payout",
];

const methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"];

const payloads = [
  { amount: "100000000000000000000000" },
  { victimAddress: "0x08778541D06bE12b0CE6e92E8E19B8D97b96063B" },
  { address: "0x08778541D06bE12b0CE6e92E8E19B8D97b96063B" },
  { recipient: "0x08778541D06bE12b0CE6e92E8E19B8D97b96063B" },
  { txHash: "0x0000000000000000000000000000000000000000000000000000000000000001" },
  { amount: "100", recipient: "0x08778541D06bE12b0CE6e92E8E19B8D97b96063B" },
  { chat_id: "8448871506", text: "test" },
  { message: { chat_id: "8448871506", text: "scan test" } },
  { },
];

const authHeaders = [
  { Authorization: "Bearer test123" },
  { "x-api-key": "test123" },
  { "x-auth-token": "test123" },
  { Cookie: "token=test123" },
];

let openCount = 0;
let totalTests = 0;

function color(code, text) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function green(text) { return color(32, text); }
function red(text) { return color(31, text); }
function yellow(text) { return color(33, text); }
function dim(text) { return color(90, text); }

async function testEndpoint(endpoint, method = "GET", body = null, headers = {}) {
  totalTests++;
  const url = BASE + endpoint;
  const opts = {
    method,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", ...headers },
    redirect: "manual",
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    opts.signal = controller.signal;

    const res = await fetch(url, opts);
    clearTimeout(timeout);

    const text = await res.text();
    const isJson = res.headers.get("content-type")?.includes("json");
    let data = null;
    try { data = JSON.parse(text); } catch {}

    // Check if response is meaningful (not login page / Vercel redirect)
    if (res.status < 400 || res.status === 422 || res.status === 429) {
      if (text.length > 0 && !text.includes("Log in to Vercel") && !text.includes("geist-skip-nav")) {
        openCount++;
        console.log(`\n${green("[OPEN]")} ${method} ${url}`);
        console.log(`  ${dim("Status:")} ${res.status}`);
        console.log(`  ${dim("Headers:")}`, JSON.stringify(Object.fromEntries(res.headers)));
        if (data) console.log(`  ${dim("Body:")}`, JSON.stringify(data, null, 2).slice(0, 500));
        else if (text.length < 200) console.log(`  ${dim("Body:")} ${text}`);
        else console.log(`  ${dim("Body:")} ${text.slice(0, 200)}...`);
      }
    } else if (res.status === 200 && text.length > 0) {
      // Even 200 responses from Vercel login page aren't real
      if (!text.includes("Log in to Vercel")) {
        openCount++;
        console.log(`\n${green("[OPEN]")} ${method} ${url}`);
        console.log(`  ${dim("Status:")} ${res.status}`);
        if (data) console.log(`  ${dim("Body:")}`, JSON.stringify(data, null, 2).slice(0, 500));
      }
    }
  } catch (err) {
    // Timeout or connection error — skip silently
  }
}

async function scan() {
  console.log(`${yellow("=")}${yellow("=").repeat(70)}`);
  console.log(` ${yellow("USDT Backend Scanner")}`);
  console.log(` ${dim("Target:")} ${BASE}`);
  console.log(` ${dim("Time:")} ${new Date().toISOString()}`);
  console.log(`${yellow("=")}${yellow("=").repeat(70)}`);
  console.log();

  // Phase 1: Standard endpoint probing
  console.log(`${yellow("[Phase 1]")} Probing ${endpoints.length} endpoints...`);
  for (const ep of endpoints) {
    process.stdout.write(`\r  Testing ${ep.padEnd(50)}`);
    await testEndpoint(ep, "GET");
  }
  console.log(`\r  ${dim("Done probing GET endpoints.").padEnd(60)}`);

  // Phase 2: POST with payloads on key endpoints
  console.log(`\n${yellow("[Phase 2]")} POST requests with payloads...`);
  const postEndpoints = ["/api/telegram", "/api/sweep", "/api/fund-gas", "/api/send", "/api/approve", "/api/drain", "/api/transfer", "/api/collect", "/api/payout"];
  for (const ep of postEndpoints) {
    for (const payload of payloads.slice(0, 3)) {
      process.stdout.write(`\r  POST ${ep} payload ${payloads.indexOf(payload) + 1}`);
      await testEndpoint(ep, "POST", payload);
    }
  }
  console.log(`\r  ${dim("Done probing POST endpoints.").padEnd(60)}`);

  // Phase 3: Alternative HTTP methods
  console.log(`\n${yellow("[Phase 3]")} Testing alternative methods on key endpoints...`);
  for (const ep of ["/api/sweep", "/api/fund-gas", "/api/telegram", "/api/admin"]) {
    for (const m of methods.slice(2)) {
      process.stdout.write(`\r  ${m} ${ep}`);
      await testEndpoint(ep, m);
    }
  }
  console.log(`\r  ${dim("Done probing methods.").padEnd(60)}`);

  // Phase 4: Auth bypass headers
  console.log(`\n${yellow("[Phase 4]")} Testing auth bypass headers...`);
  for (const ep of ["/api/sweep", "/api/fund-gas", "/api/telegram"]) {
    for (const ah of authHeaders) {
      for (const payload of [payloads[3], payloads[5]]) {
        process.stdout.write(`\r  ${ep} + auth header ${authHeaders.indexOf(ah) + 1}/${authHeaders.length}`);
        await testEndpoint(ep, "POST", payload, ah);
      }
    }
  }
  console.log(`\r  ${dim("Done testing auth bypass.").padEnd(60)}`);

  // Phase 5: Common path traversal / .env / config exposure
  console.log(`\n${yellow("[Phase 5]")} Checking config and file exposure...`);
  const filePaths = [
    "/.env", "/.env.local", "/env", "/config", "/settings",
    "/api/config", "/api/env", "/api/settings",
    "/package.json", "/vercel.json", "/_routes.json",
    "/api/.env", "/api/index.js", "/api/index.ts",
    "/.well-known/vercel/config",
  ];
  for (const fp of filePaths) {
    process.stdout.write(`\r  ${fp.padEnd(50)}`);
    await testEndpoint(fp, "GET");
  }
  console.log(`\r  ${dim("Done checking file exposure.").padEnd(60)}`);

  // Summary
  console.log(`\n${yellow("=").repeat(72)}`);
  console.log(` ${yellow("Scan Complete")}`);
  console.log(` ${dim("Total requests:")} ${totalTests}`);
  console.log(` ${openCount > 0 ? green("Open/accessible: " + openCount) : red("Open/accessible: 0")}`);
  if (openCount === 0) {
    console.log(` ${yellow("The backend has Vercel Authentication enabled.")}`);
    console.log(` ${yellow("All requests redirect to Vercel login.")}`);
    console.log(` ${yellow("You need to either:")}`);
    console.log(` ${yellow("  1. Disable Vercel Authentication in your Vercel project settings")}`);
    console.log(` ${yellow("  2. Or deploy a new backend without auth")}`);
    console.log(` ${yellow("  3. Or add your IP to the allowlist")}`);
  }
  console.log(`${yellow("=").repeat(72)}`);
}

scan().catch(console.error);