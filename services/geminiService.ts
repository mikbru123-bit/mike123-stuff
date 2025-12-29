
import { GoogleGenAI } from "@google/genai";

export async function getMissionText(): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate a short, funny 1-sentence mission briefing for a 'Laser Cat' defending space from dogs and yarn balls.",
      config: {
        systemInstruction: "You are a galactic cat commander. Keep it punchy and feline-themed.",
        temperature: 0.8,
      },
    });
    return response.text || "Protect the galaxy, Laser Cat! Beware of the golden retrievers!";
  } catch (error) {
    console.error("Gemini mission error:", error);
    return "The yarn-ocalypse is upon us. Fire the lasers!";
  }
}
