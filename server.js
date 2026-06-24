const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "10mb" }));

app.use(express.static("public"));

const PROMPTS = {
  general: (food) => `You are a global food ingredient analyst. Analyse this food: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","ingredients":[{"name":"Wheat Flour","status":"warn","what":"refined white flour"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"alerts":["concern"],"ayurveda":"one sentence","verdict":"one sentence"}
status: safe=natural, warn=processed, bad=artificial. List 6-14 ingredients. JSON only.`,

  kids: (food) => `You are a child nutrition expert. Analyse for children aged 1-12: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kid_verdict":"SAFE","kid_verdict_reason":"one sentence","fun_fact":"fun fact","ingredients":[{"name":"Sugar","status":"warn","what":"refined"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"sugar_level":"Low","artificial_colours":false,"allergens":[],"alerts":[],"verdict":"one sentence"}
kid_verdict: SAFE/CAUTION/AVOID. JSON only.`,

  kidney: (food) => `You are a renal dietitian. Analyse for kidney disease patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","kidney_verdict":"SAFE","kidney_verdict_reason":"one sentence","ingredients":[{"name":"Salt","status":"warn","what":"sodium"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"renal_markers":{"potassium":"Low","phosphorus":"Low","sodium":"Low","fluid":"Low"},"dialysis_note":"one sentence","safe_portion":"e.g. half cup","alerts":[],"verdict":"one sentence"}
kidney_verdict: SAFE/LIMIT/AVOID. renal_markers: Low/Medium/High/Very High. JSON only.`,

  dog: (food) => `You are a veterinary nutritionist. Analyse if safe for dogs: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","dog_verdict":"SAFE","dog_verdict_reason":"one sentence","fun_fact":"dog fun fact","ingredients":[{"name":"Chicken","status":"safe","what":"lean protein"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":5,"fat":10},"toxic_ingredients":[],"safe_for_puppies":true,"safe_for_puppies_reason":"one sentence","vet_note":"one sentence","alerts":[],"verdict":"one sentence"}
dog_verdict: SAFE/CAUTION/AVOID. Toxic to dogs: chocolate, grapes, raisins, onion, garlic, xylitol, avocado, macadamia, alcohol, caffeine. JSON only.`,

  diabetes: (food) => `You are a diabetes nutrition expert. Analyse for Type 2 diabetes: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","diabetes_verdict":"SAFE","diabetes_reason":"one sentence","ingredients":[{"name":"Sugar","status":"bad","what":"spikes blood sugar"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"gi_level":"Low","gi_score":40,"blood_sugar_impact":"one sentence","diabetes_safe_portion":"e.g. 1 apple","alerts":[],"verdict":"one sentence"}
diabetes_verdict: SAFE/CAUTION/AVOID. JSON only.`,

  heart: (food) => `You are a cardiac dietitian. Analyse for heart disease patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","heart_verdict":"SAFE","heart_reason":"one sentence","ingredients":[{"name":"Fat","status":"warn","what":"saturated fat"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"cholesterol_impact":"Positive","sodium_level":"Low","saturated_fat":"Low","heart_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
heart_verdict: SAFE/CAUTION/AVOID. cholesterol_impact: Positive/Neutral/Negative. JSON only.`,

  bp: (food) => `You are a hypertension dietitian. Analyse for high blood pressure: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","bp_verdict":"SAFE","bp_reason":"one sentence","ingredients":[{"name":"Salt","status":"bad","what":"raises BP"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"bp_sodium":"Low","bp_potassium":"High","dash_rating":"Excellent","bp_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
bp_verdict: SAFE/CAUTION/AVOID. JSON only.`,

  thyroid: (food) => `You are a thyroid nutrition expert. Analyse for thyroid patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","thyroid_verdict":"SAFE","thyroid_reason":"one sentence","ingredients":[{"name":"Iodine","status":"safe","what":"supports thyroid"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"goitrogen_level":"None","iodine_content":"Medium","thyroid_type":"Both safe","thyroid_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
thyroid_verdict: SAFE/CAUTION/AVOID. goitrogen_level: None/Low/Medium/High. JSON only.`,

  pcod: (food) => `You are a PCOD nutrition expert. Analyse for PCOD/PCOS patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","pcod_verdict":"SAFE","pcod_reason":"one sentence","ingredients":[{"name":"Sugar","status":"bad","what":"worsens insulin resistance"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"insulin_impact":"Low","inflammation_level":"Low","hormone_impact":"one sentence","pcod_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
pcod_verdict: SAFE/CAUTION/AVOID. JSON only.`,

  liver: (food) => `You are a liver health dietitian. Analyse for liver disease patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","liver_verdict":"SAFE","liver_reason":"one sentence","ingredients":[{"name":"Turmeric","status":"safe","what":"protects liver"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"liver_toxins":[],"detox_rating":"Good","fatty_liver_risk":"Low","liver_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
liver_verdict: SAFE/CAUTION/AVOID. detox_rating: Excellent/Good/Moderate/Poor. JSON only.`,

  cancer: (food) => `You are an oncology dietitian. Analyse for cancer prevention: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","cancer_verdict":"SAFE","cancer_reason":"one sentence","ingredients":[{"name":"Antioxidants","status":"safe","what":"fights cancer cells"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"carcinogen_risk":"Low","antioxidant_level":"High","cancer_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
cancer_verdict: SAFE/CAUTION/AVOID. carcinogen_risk: Low/Medium/High. JSON only.`,

  anaemia: (food) => `You are a haematology dietitian. Analyse for anaemia patients: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","anaemia_verdict":"SAFE","anaemia_reason":"one sentence","ingredients":[{"name":"Iron","status":"safe","what":"builds haemoglobin"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"iron_content":"High","b12_level":"Medium","iron_absorption":"one sentence","anaemia_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
anaemia_verdict: SAFE/CAUTION/AVOID. iron_content: Low/Medium/High/Very High. JSON only.`,

  bone: (food) => `You are an orthopaedic dietitian. Analyse for bone health and arthritis: "${food}"
Return ONLY valid JSON, no other text:
{"food_name":"full name","origin":"country","bone_verdict":"SAFE","bone_reason":"one sentence","ingredients":[{"name":"Calcium","status":"safe","what":"builds bones"}],"health_score":"B","score_reason":"one sentence","nutrients":{"protein":20,"fibre":10,"sugar":30},"calcium_content":"High","inflammation_effect":"Reduces","bone_safe_portion":"e.g. 1 cup","alerts":[],"verdict":"one sentence"}
bone_verdict: SAFE/CAUTION/AVOID. calcium_content: Low/Medium/High. JSON only.`,
};

app.post("/api/scan", async (req, res) => {
  const { food, mode = "general", imageData, mimeType } = req.body;
  if (!food && !imageData) return res.status(400).json({ error: "No food provided." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "API key not configured. Please add ANTHROPIC_API_KEY in Render environment variables." });

  try {
    const prompt = PROMPTS[mode]?.(food || "the food in this image") || PROMPTS.general(food || "this food");
    let messages;
    if (imageData) {
      messages = [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageData } },
        { type: "text", text: `Look at this food image or label. Identify the food and analyse it.\n${prompt}` }
      ]}];
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
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Could not parse response. Please try again." });
    res.json(JSON.parse(raw.slice(s, e + 1)));
  } catch (err) {
    res.status(500).json({ error: err.message || "Something went wrong. Please try again." });
  }
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LabelPe running on port ${PORT}`));
