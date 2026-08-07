export const generateScenarioWithAI = async (apiKey, findingQuery) => {
  if (!apiKey) throw new Error("API Key is required.");

  // 1. Fetch available models to auto-detect the correct model name for this specific API key
  const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  let modelsResponse;
  try {
    modelsResponse = await fetch(modelsUrl);
  } catch (err) {
    throw new Error("Network error when fetching models list. Check your internet connection.");
  }
  
  if (!modelsResponse.ok) {
    let errorData;
    try { errorData = await modelsResponse.json(); } catch(e) {}
    throw new Error("Failed to fetch models list: " + (errorData?.error?.message || modelsResponse.statusText));
  }
  
  const modelsData = await modelsResponse.json();
  const availableModels = modelsData.models || [];
  const generateModels = availableModels.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
  
  if (generateModels.length === 0) {
    throw new Error("Your API key does not have access to any models that support text generation.");
  }

  // Preference order - use strict equality to avoid matching un-quota'd models like gemini-3.1-pro
  let selectedModel = generateModels.find(m => m.name === "models/gemini-1.5-flash") ||
                      generateModels.find(m => m.name === "models/gemini-1.5-flash-latest") ||
                      generateModels.find(m => m.name === "models/gemini-1.5-pro") ||
                      generateModels.find(m => m.name === "models/gemini-pro") ||
                      generateModels.find(m => m.name.includes("flash")) ||
                      generateModels[0];

  console.log("Auto-selected Gemini Model:", selectedModel.name);

  const systemInstruction = `
You are an elite Bug Bounty Intelligence Engine.
The user will provide a finding (e.g., "Found a Jenkins server", "Found an exposed .git directory").
Your job is to generate an actionable, deeply technical scenario for what to do next.

You MUST respond ONLY with a valid JSON object matching this exact structure:
{
  "id": "generated-<uuid>",
  "category": "<one of: recon, tech, endpoints, auth, features, files>",
  "finding": "<Title of the finding>",
  "why": "<1-2 sentences explaining why this matters>",
  "whatToDoNow": [
    "<actionable step 1>",
    "<actionable step 2>"
  ],
  "decisionTree": {
    "question": "<A yes/no question about the finding context>",
    "yes": {
      "action": "<What to do if yes>",
      "next": null
    },
    "no": {
      "action": "<What to do if no>",
      "next": null
    }
  },
  "attacksUnlocked": ["<Attack 1>"],
  "connectsTo": ["<Phase or connection 1>"]
}

Make the advice highly technical and specific to bug bounty hunting. No fluff. Do NOT wrap the JSON in markdown code blocks. Output ONLY raw JSON.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `System Instruction: ${systemInstruction}\n\nFinding to analyze: ${findingQuery}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to call Gemini API");
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
     throw new Error("AI returned no content.");
  }
  
  const text = data.candidates[0].content.parts[0].text;
  
  try {
    const parsed = JSON.parse(text);
    parsed.id = `ai-${Date.now()}`;
    return parsed;
  } catch (e) {
    throw new Error("AI returned invalid JSON: " + text);
  }
};
