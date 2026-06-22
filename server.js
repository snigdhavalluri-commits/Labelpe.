const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
app.use(express.static("."));

const PROMPTS = {
  general: (food) => `You are a global food ingredient analyst. Analyse this food: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","ingredients":[{"name":"Wheat Flour","status":"warn","what":"refined white flour"},{"name":"Salt","status":"safe","what":"natural mineral"},{"name":"MSG","status":"bad","what":"artificial flavour enhancer"}],"health_score":"A|B|C|D","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"alerts":["concern 1"],"ayurveda":"one sentence on Vata/Pitta/Kapha","verdict":"one sentence recommendation"}
Rules: status = safe (natural/whole), warn (processed/refined), bad (artificial/harmful). List 6-14 real ingredients. All English. JSON only.`,

  kids: (food) => `You are a child nutrition expert. Analyse this food for children aged 1-12: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kid_verdict":"SAFE|CAUTION|AVOID","kid_verdict_reason":"one sentence for parents","fun_fact":"one fun fact a child would enjoy","ingredients":[{"name":"Sugar","status":"warn","what":"refined sweetener"}],"health_score":"A|B|C|D","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"sugar_level":"Low|Medium|High|Very High","artificial_colours":true,"allergens":["Gluten","Milk"],"alerts":["concern 1"],"verdict":"one sentence for parents"}
Rules: SAFE=healthy daily, CAUTION=occasionally, AVOID=not for kids. Flag MSG, artificial colours, excess sugar, caffeine. All English. JSON only.`,

  kidney: (food) => `You are a renal dietitian. Analyse this food for kidney disease and dialysis patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kidney_verdict":"SAFE|LIMIT|AVOID","kidney_verdict_reason":"one sentence for kidney patients","ingredients":[{"name":"Potato","status":"warn","what":"high potassium vegetable"}],"health_score":"A|B|C|D","score_reason":"one sentence focused on kidney health","nutrients":{"protein":20,"fibre":10,"sugar":30},"renal_markers":{"potassium":"Low|Medium|High|Very High","phosphorus":"Low|Medium|High|Very High","sodium":"Low|Medium|High|Very High","fluid":"Low|Medium|High"},"dialysis_note":"one specific sentence for dialysis patients","safe_portion":"safe portion size e.g. half cup 80g","alerts":["High potassium","High sodium"],"verdict":"one sentence on frequency for kidney patients"}
Rules: SAFE=fine for most kidney patients, LIMIT=small portions only, AVOID=dangerous. Be medically accurate. All English. JSON only.`
};

app.post("/api/scan", async (req, res) => {
  const { food, mode = "general" } = req.body;
  if (!food) return res.status(400).json({ error: "No food provided" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not configured. Add ANTHROPIC_API_KEY to your environment variables." });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: PROMPTS[mode]?.(food) || PROMPTS.general(food) }],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = (data.content?.[0]?.text || "").trim();
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Could not parse AI response" });
    res.json(JSON.parse(raw.slice(s, e + 1)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🏷️  LabelPe running → http://localhost:${PORT}\n`));
