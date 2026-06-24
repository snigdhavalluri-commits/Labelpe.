const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "10mb" }));

// ── PASSWORD PROTECTION ───────────────────────────────────────────
const SITE_PASSWORD = process.env.SITE_PASSWORD || "LabelPe2025";

const isAuth = (req) => (req.headers.cookie || "").includes("lp_auth=granted");

app.get("/login", (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LabelPe Login</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0F0F1A;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.card{background:#1A1A2E;border-radius:24px;padding:2.5rem;width:90%;max-width:380px;text-align:center}.logo{font-size:2rem;font-weight:900;margin-bottom:0.25rem}.pe{color:#E8A020}.sub{font-size:0.72rem;color:rgba(255,255,255,0.3);letter-spacing:0.1em;margin-bottom:2rem}input{width:100%;padding:0.9rem;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:1rem;outline:none;margin-bottom:1rem;text-align:center;letter-spacing:0.1em}input:focus{border-color:#E8A020}button{width:100%;padding:0.9rem;border-radius:12px;border:none;background:#E8A020;color:#1A1A1A;font-size:1rem;font-weight:700;cursor:pointer}.err{color:#F87171;font-size:0.85rem;margin-top:0.75rem;display:none}.hint{color:rgba(255,255,255,0.2);font-size:0.7rem;margin-top:1.5rem}</style></head>
<body><div class="card"><div class="logo">Label<span class="pe">Pe</span>•</div><div class="sub">READ THE LABEL. EAT RIGHT.</div>
<input type="password" id="pw" placeholder="Enter password" onkeydown="if(event.key==='Enter')check()"/>
<button onclick="check()">Enter LabelPe →</button>
<div class="err" id="err">❌ Wrong password. Please try again.</div>
<div class="hint">Private access only · © 2025 LabelPe Pvt Ltd</div></div>
<script>function check(){const pw=document.getElementById('pw').value;fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})}).then(r=>r.json()).then(d=>{if(d.success)window.location.href='/';else document.getElementById('err').style.display='block';});}</script>
</body></html>`);
});

app.post("/api/auth", (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    res.setHeader("Set-Cookie", "lp_auth=granted; Path=/; Max-Age=604800; SameSite=Strict");
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// ── STATIC FILES (serve after auth check for pages) ───────────────
app.use((req, res, next) => {
  // API routes handle their own auth and return JSON errors
  if (req.path.startsWith("/api/")) return next();
  // Login page is always accessible
  if (req.path === "/login") return next();
  // All other pages require auth cookie — redirect to login
  if (!isAuth(req)) return res.redirect("/login");
  next();
});

app.use(express.static("public"));

// ── ALL 13 MODE PROMPTS ────────────────────────────────────────────
const PROMPTS = {
  general: (food) => `You are a global food ingredient analyst. Analyse this food: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","ingredients":[{"name":"Wheat Flour","status":"warn","what":"refined white flour"},{"name":"Salt","status":"safe","what":"natural mineral"},{"name":"MSG","status":"bad","what":"artificial flavour enhancer"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"alerts":["concern"],"ayurveda":"one sentence on Vata/Pitta/Kapha","verdict":"one sentence recommendation"}
status: safe=natural/whole, warn=processed/refined, bad=artificial/harmful. List 6-14 real ingredients. All English. JSON only.`,

  kids: (food) => `You are a child nutrition expert. Analyse this food for children aged 1-12: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kid_verdict":"SAFE","kid_verdict_reason":"one sentence for parents","fun_fact":"one fun fact a child would enjoy","ingredients":[{"name":"Sugar","status":"warn","what":"refined sweetener"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"sugar_level":"Low","artificial_colours":false,"allergens":["Gluten"],"alerts":["concern"],"verdict":"one sentence for parents"}
kid_verdict: SAFE=healthy daily, CAUTION=occasionally, AVOID=not for kids. Flag MSG, artificial colours, excess sugar, caffeine. All English. JSON only.`,

  kidney: (food) => `You are a renal dietitian. Analyse this food for kidney disease and dialysis patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kidney_verdict":"SAFE","kidney_verdict_reason":"one sentence for kidney patients","ingredients":[{"name":"Potato","status":"warn","what":"high potassium vegetable"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"renal_markers":{"potassium":"Low","phosphorus":"Low","sodium":"Low","fluid":"Low"},"dialysis_note":"one sentence for dialysis patients","safe_portion":"e.g. half cup 80g","alerts":["concern"],"verdict":"one sentence for kidney patients"}
kidney_verdict: SAFE=fine, LIMIT=small portions only, AVOID=dangerous. renal_markers values: Low/Medium/High/Very High. All English. JSON only.`,

  dog: (food) => `You are a veterinary nutritionist. Analyse this food for dogs: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","dog_verdict":"SAFE","dog_verdict_reason":"one sentence for dog owners","fun_fact":"one fun dog fact","ingredients":[{"name":"Chicken","status":"safe","what":"lean protein"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":5,"fat":10},"toxic_ingredients":[],"safe_for_puppies":true,"safe_for_puppies_reason":"one sentence","vet_note":"one important vet note","alerts":[],"verdict":"one sentence — can dogs eat this?"}
dog_verdict: SAFE=fine for dogs, CAUTION=small amounts only, AVOID=dangerous or toxic. Foods toxic to dogs: chocolate, grapes, raisins, onion, garlic, xylitol, avocado, macadamia nuts, alcohol, caffeine. All English. JSON only.`,

  diabetes: (food) => `You are a diabetes nutrition expert. Analyse this food for Type 2 diabetes patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","diabetes_verdict":"SAFE","diabetes_reason":"one sentence for diabetics","ingredients":[{"name":"Sugar","status":"bad","what":"refined sweetener"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"gi_level":"Low","gi_score":40,"blood_sugar_impact":"one sentence on blood sugar effect","diabetes_safe_portion":"e.g. half cup or avoid","alerts":["concern"],"verdict":"one sentence for diabetics"}
diabetes_verdict: SAFE=low GI fine, CAUTION=moderate GI eat carefully, AVOID=high GI dangerous. All English. JSON only.`,

  heart: (food) => `You are a cardiac dietitian. Analyse this food for heart disease patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","heart_verdict":"SAFE","heart_reason":"one sentence for heart patients","ingredients":[{"name":"Saturated Fat","status":"bad","what":"raises LDL cholesterol"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"cholesterol_impact":"Positive","sodium_level":"Low","saturated_fat":"Low","heart_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for heart patients"}
heart_verdict: SAFE=heart healthy, CAUTION=limit portion, AVOID=harmful for heart. cholesterol_impact: Positive/Neutral/Negative. All English. JSON only.`,

  bp: (food) => `You are a hypertension dietitian. Analyse this food for high blood pressure patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","bp_verdict":"SAFE","bp_reason":"one sentence for BP patients","ingredients":[{"name":"Salt","status":"bad","what":"raises blood pressure"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"bp_sodium":"Low","bp_potassium":"High","dash_rating":"Excellent","bp_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for BP patients"}
bp_verdict: SAFE=BP friendly, CAUTION=moderate, AVOID=raises BP. DASH diet principles apply. All English. JSON only.`,

  thyroid: (food) => `You are a thyroid nutrition expert. Analyse this food for thyroid patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","thyroid_verdict":"SAFE","thyroid_reason":"one sentence for thyroid patients","ingredients":[{"name":"Broccoli","status":"warn","what":"contains goitrogens"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"goitrogen_level":"None","iodine_content":"Medium","thyroid_type":"Both safe","thyroid_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for thyroid patients"}
thyroid_verdict: SAFE=safe for thyroid, CAUTION=eat carefully, AVOID=harmful. goitrogen_level: None/Low/Medium/High. All English. JSON only.`,

  pcod: (food) => `You are a PCOD and PCOS nutrition expert. Analyse this food for PCOD/PCOS patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","pcod_verdict":"SAFE","pcod_reason":"one sentence for PCOD patients","ingredients":[{"name":"Sugar","status":"bad","what":"worsens insulin resistance"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"insulin_impact":"Low","inflammation_level":"Low","hormone_impact":"one sentence on hormone effect","pcod_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for PCOD patients"}
pcod_verdict: SAFE=good for PCOD, CAUTION=limit, AVOID=worsens PCOD. Focus on insulin resistance and inflammation. All English. JSON only.`,

  liver: (food) => `You are a liver health dietitian. Analyse this food for liver disease and fatty liver patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","liver_verdict":"SAFE","liver_reason":"one sentence for liver patients","ingredients":[{"name":"Turmeric","status":"safe","what":"protects liver cells"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"liver_toxins":[],"detox_rating":"Excellent","fatty_liver_risk":"Low","liver_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for liver patients"}
liver_verdict: SAFE=good for liver, CAUTION=limit, AVOID=harmful. detox_rating: Excellent/Good/Moderate/Poor/Very Poor. All English. JSON only.`,

  cancer: (food) => `You are an oncology dietitian. Analyse this food for cancer prevention and cancer patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","cancer_verdict":"SAFE","cancer_reason":"one sentence on cancer risk","ingredients":[{"name":"Lycopene","status":"safe","what":"anti-cancer antioxidant"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"carcinogen_risk":"Low","antioxidant_level":"High","cancer_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for cancer prevention"}
cancer_verdict: SAFE=anti-cancer beneficial, CAUTION=neutral, AVOID=carcinogenic risk. carcinogen_risk: Low/Medium/High. antioxidant_level: Low/Medium/High/Very High. All English. JSON only.`,

  anaemia: (food) => `You are a haematology dietitian. Analyse this food for anaemia and low haemoglobin patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","anaemia_verdict":"SAFE","anaemia_reason":"one sentence for anaemia patients","ingredients":[{"name":"Iron","status":"safe","what":"builds red blood cells"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"iron_content":"High","b12_level":"High","iron_absorption":"Vitamin C enhances absorption","anaemia_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for anaemia patients"}
anaemia_verdict: SAFE=iron rich helps anaemia, CAUTION=moderate, AVOID=blocks iron absorption. iron_content: Low/Medium/High/Very High. All English. JSON only.`,

  bone: (food) => `You are an orthopaedic dietitian. Analyse this food for bone health and arthritis patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","bone_verdict":"SAFE","bone_reason":"one sentence for bone patients","ingredients":[{"name":"Calcium","status":"safe","what":"builds strong bones"}],"health_score":"A","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"calcium_content":"High","inflammation_effect":"Reduces","bone_safe_portion":"e.g. 1 cup daily","alerts":["concern"],"verdict":"one sentence for bone and joint health"}
bone_verdict: SAFE=good for bones and joints, CAUTION=moderate, AVOID=harmful to bones or increases inflammation. calcium_content: Low/Medium/High. inflammation_effect: Reduces/Neutral/Increases. All English. JSON only.`,
};

// ── SCAN API ──────────────────────────────────────────────────────
app.post("/api/scan", async (req, res) => {
  if (!isAuth(req)) return res.status(401).json({ error: "Please login first." });
  const { food, mode = "general", imageData, mimeType } = req.body;
  if (!food && !imageData) return res.status(400).json({ error: "No food provided." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not configured. Add ANTHROPIC_API_KEY in Render environment variables." });

  try {
    const prompt = PROMPTS[mode]?.(food || "the food shown in this image") || PROMPTS.general(food || "the food in this image");
    let messages;
    if (imageData) {
      // Image scan mode
      messages = [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageData } },
          { type: "text", text: `Look at this food label or food image. Identify the food and analyse it.\n${prompt}` }
        ]
      }];
    } else {
      messages = [{ role: "user", content: prompt }];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, messages }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = (data.content?.[0]?.text || "").trim();
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Could not parse AI response. Please try again." });
    res.json(JSON.parse(raw.slice(s, e + 1)));
  } catch (err) {
    res.status(500).json({ error: err.message || "Something went wrong. Please try again." });
  }
});
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🏷️  LabelPe running → http://localhost:${PORT}\n`));
