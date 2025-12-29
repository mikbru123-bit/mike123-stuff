
import { LeaderboardEntry } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const STORAGE_KEY = 'laser_cat_high_scores';

const MOCK_NAMES = [
  "Nebula-Nip", "Star-Whisker", "Cosmic-Paws", "Lunar-Tail", "Galaxy-Gaze",
  "Astro-Mew", "Void-Viper", "Supernova-Slinker", "Quasar-Claw", "Meteor-Meow"
];

export class LeaderboardService {
  public static getScores(): LeaderboardEntry[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Initial seed scores
    const seed: LeaderboardEntry[] = MOCK_NAMES.map((name, i) => ({
      name,
      score: (10 - i) * 500 + Math.floor(Math.random() * 200),
      date: new Date().toLocaleDateString()
    }));
    this.saveScores(seed);
    return seed;
  }

  public static saveScore(name: string, score: number): LeaderboardEntry[] {
    const scores = this.getScores();
    const newEntry: LeaderboardEntry = {
      name: name || "ANON-CAT",
      score,
      date: new Date().toLocaleDateString(),
      isPlayer: true
    };
    
    const updated = [...scores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    this.saveScores(updated);
    return updated;
  }

  private static saveScores(scores: LeaderboardEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  public static async getAIPuns(score: number): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `The player just scored ${score} points in Laser Cat. Generate a very short, funny "paws-itive" or "cat-astrophic" comment based on this score.`,
        config: {
          systemInstruction: "You are a cynical but impressed feline commander.",
          temperature: 0.9,
        },
      });
      return response.text || "Not bad for a hairball.";
    } catch {
      return "The laser array is cooling down.";
    }
  }
}
