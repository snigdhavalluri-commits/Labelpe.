const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "10mb" }));

const SITE_PASSWORD = process.env.SITE_PASSWORD || "LabelPe2025";
const isAuth = (req) => (req.headers.cookie || "").includes("lp_auth=granted");

// ── LOGIN PAGE ─────────────────────────────────────────────────────
app.get("/login", (req, res) => {
  res.send(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LabelPe Login</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0F0F1A;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#1A1A2E;border-radius:24px;padding:2.5rem;width:90%;max-width:360px;text-align:center}
.logo{font-size:2rem;font-weight:900;color:#fff;margin-bottom:0.2rem}
.logo span{color:#E8A020}
.sub{font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:0.1em;margin-bottom:2rem}
input{width:100%;padding:0.9rem;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:1rem;outline:none;margin-bottom:1rem;text-align:center;letter-spacing:0.1em;font-family:inherit}
input:focus{border-color:#E8A020}
button{width:100%;padding:0.9rem;border-radius:12px;border:none;background:#E8A020;color:#1A1A1A;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit}
.err{color:#F87171;font-size:0.85rem;margin-top:0.75rem;display:none}
.hint{color:rgba(255,255,255,0.2);font-size:0.7rem;margin-top:1.5rem}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Label<span>Pe</span>•</div>
  <div class="sub">READ THE LABEL. EAT RIGHT.</div>
  <input type="password" id="pw" placeholder="Enter password" onkeydown="if(event.key==='Enter')login()"/>
  <button onclick="login()">Enter LabelPe →</button>
  <div class="err" id="err">❌ Wrong password. Try again.</div>
  <div class="hint">Private access only</div>
</div>
<script>
function login(){
  fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})})
  .then(r=>r.json()).then(d=>{
    if(d.ok) window.location.href='/';
    else document.getElementById('err').style.display='block';
  });
}
</script>
</body></html>`);
});

// ── AUTH CHECK ENDPOINT (returns JSON always) ──────────────────────
app.post("/api/auth", (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    res.setHeader("Set-Cookie", "lp_auth=granted; Path=/; Max-Age=604800; SameSite=Strict");
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

// ── SCAN ENDPOINT (returns JSON always — NEVER redirects) ──────────
app.post("/api/scan", async (req, res) => {
  // If not logged in → return JSON error (NOT a redirect)
  if (!isAuth(req)) {
    return res.status(401).json({ error: "Please login first at labelpe.onrender.com/login" });
  }

  const { food, mode = "general", imageData, mimeType } = req.body;
  if (!food && !imageData) return res.status(400).json({ error: "No food provided." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not configured." });

  try {
    const promptFn = PROMPTS[mode] || PROMPTS.general;
    const promptText = promptFn(food || "the food in this image");
    let messages;

    if (imageData) {
      messages = [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageData } },
        { type: "text", text: `Look at this food image or label. Identify the food and analyse it.\n${promptText}` }
      ]}];
    } else {
      messages = [{ role: "user", content: promptText }];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = (data.content?.[0]?.text || "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return res.status(500).json({ error: "Could not parse response. Please try again." });

    res.json(JSON.parse(raw.slice(start, end + 1)));
  } catch (err) {
    res.status(500).json({ error: err.message || "Something went wrong. Please try again." });
  }
});

// ── ALL 13 MODE PROMPTS ────────────────────────────────────────────
const PROMPTS = {
  general: (f) => `Analyse this food: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","ingredients":[{"name":"Salt","status":"safe","what":"natural mineral"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"alerts":[],"ayurveda":"one sentence","verdict":"one sentence"}
status: safe=natural, warn=processed, bad=artificial. List 6-12 ingredients. JSON only.`,

  kids: (f) => `Analyse this food for children aged 1-12: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","kid_verdict":"SAFE","kid_verdict_reason":"one sentence","fun_fact":"fun fact","ingredients":[{"name":"Sugar","status":"warn","what":"refined sugar"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"sugar_level":"Low","artificial_colours":false,"allergens":[],"alerts":[],"verdict":"one sentence"}
kid_verdict: SAFE, CAUTION, or AVOID. JSON only.`,

  kidney: (f) => `Analyse this food for kidney disease and dialysis patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","kidney_verdict":"SAFE","kidney_verdict_reason":"one sentence","ingredients":[{"name":"Salt","status":"warn","what":"high sodium"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"renal_markers":{"potassium":"Low","phosphorus":"Low","sodium":"Low","fluid":"Low"},"dialysis_note":"one sentence","safe_portion":"e.g. half cup","alerts":[],"verdict":"one sentence"}
kidney_verdict: SAFE, LIMIT, or AVOID. renal_markers: Low, Medium, High, Very High. JSON only.`,

  dog: (f) => `Analyse if safe for dogs: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","dog_verdict":"SAFE","dog_verdict_reason":"one sentence","fun_fact":"dog fun fact","ingredients":[{"name":"Chicken","status":"safe","what":"lean protein"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":5,"fat":10},"toxic_ingredients":[],"safe_for_puppies":true,"safe_for_puppies_reason":"one sentence","vet_note":"one sentence","alerts":[],"verdict":"one sentence"}
dog_verdict: SAFE, CAUTION, or AVOID. Toxic to dogs: chocolate, grapes, raisins, onion, garlic, xylitol, avocado, macadamia, alcohol, caffeine. JSON only.`,

  diabetes: (f) => `Analyse for Type 2 diabetes patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","diabetes_verdict":"SAFE","diabetes_reason":"one sentence","ingredients":[{"name":"Sugar","status":"bad","what":"spikes blood sugar"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"gi_level":"Low","gi_score":40,"blood_sugar_impact":"one sentence","diabetes_safe_portion":"e.g. 1 apple daily","alerts":[],"verdict":"one sentence"}
diabetes_verdict: SAFE, CAUTION, or AVOID. JSON only.`,

  heart: (f) => `Analyse for heart disease patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","heart_verdict":"SAFE","heart_reason":"one sentence","ingredients":[{"name":"Fat","status":"warn","what":"saturated fat"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"cholesterol_impact":"Positive","sodium_level":"Low","saturated_fat":"Low","heart_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
heart_verdict: SAFE, CAUTION, or AVOID. cholesterol_impact: Positive, Neutral, or Negative. JSON only.`,

  bp: (f) => `Analyse for high blood pressure patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","bp_verdict":"SAFE","bp_reason":"one sentence","ingredients":[{"name":"Salt","status":"bad","what":"raises blood pressure"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"bp_sodium":"Low","bp_potassium":"High","dash_rating":"Good","bp_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
bp_verdict: SAFE, CAUTION, or AVOID. JSON only.`,

  thyroid: (f) => `Analyse for thyroid patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","thyroid_verdict":"SAFE","thyroid_reason":"one sentence","ingredients":[{"name":"Iodine","status":"safe","what":"supports thyroid"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"goitrogen_level":"None","iodine_content":"Medium","thyroid_type":"Both safe","thyroid_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
thyroid_verdict: SAFE, CAUTION, or AVOID. goitrogen_level: None, Low, Medium, High. JSON only.`,

  pcod: (f) => `Analyse for PCOD and PCOS patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","pcod_verdict":"SAFE","pcod_reason":"one sentence","ingredients":[{"name":"Sugar","status":"bad","what":"worsens insulin resistance"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"insulin_impact":"Low","inflammation_level":"Low","hormone_impact":"one sentence","pcod_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
pcod_verdict: SAFE, CAUTION, or AVOID. JSON only.`,

  liver: (f) => `Analyse for liver disease and fatty liver patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","liver_verdict":"SAFE","liver_reason":"one sentence","ingredients":[{"name":"Turmeric","status":"safe","what":"protects liver"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"liver_toxins":[],"detox_rating":"Good","fatty_liver_risk":"Low","liver_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
liver_verdict: SAFE, CAUTION, or AVOID. detox_rating: Excellent, Good, Moderate, Poor. JSON only.`,

  cancer: (f) => `Analyse for cancer prevention: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","cancer_verdict":"SAFE","cancer_reason":"one sentence","ingredients":[{"name":"Antioxidants","status":"safe","what":"fights cancer cells"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"carcinogen_risk":"Low","antioxidant_level":"High","cancer_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
cancer_verdict: SAFE, CAUTION, or AVOID. carcinogen_risk: Low, Medium, High. JSON only.`,

  anaemia: (f) => `Analyse for anaemia and low haemoglobin patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","anaemia_verdict":"SAFE","anaemia_reason":"one sentence","ingredients":[{"name":"Iron","status":"safe","what":"builds haemoglobin"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"iron_content":"High","b12_level":"Medium","iron_absorption":"one sentence","anaemia_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
anaemia_verdict: SAFE, CAUTION, or AVOID. iron_content: Low, Medium, High, Very High. JSON only.`,

  bone: (f) => `Analyse for bone health and arthritis patients: "${f}". Return ONLY JSON no other text:
{"food_name":"name","origin":"country","bone_verdict":"SAFE","bone_reason":"one sentence","ingredients":[{"name":"Calcium","status":"safe","what":"builds bones"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":10,"fibre":5,"sugar":10},"calcium_content":"High","inflammation_effect":"Reduces","bone_safe_portion":"e.g. 1 cup daily","alerts":[],"verdict":"one sentence"}
bone_verdict: SAFE, CAUTION, or AVOID. calcium_content: Low, Medium, High. JSON only.`,
};

// ── SERVE PAGES (with auth check — redirect to login) ─────────────
app.use((req, res, next) => {
  // API routes already handled above — should not reach here
  // Static assets (.js .css .png etc) — always serve
  if (req.path.includes('.')) return next();
  // Login page — always serve
  if (req.path === '/login') return next();
  // All other pages — require login
  if (!isAuth(req)) return res.redirect('/login');
  next();
});

app.use(express.static("public"));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LabelPe running on port ${PORT}`)
