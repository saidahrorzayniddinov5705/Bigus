/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateTreatmentContext(medName: string, type: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Explain simply why it is critical for a patient to finish the full course of ${medName} (${type}). Focus on the science of what happens if they stop early (e.g. resistance or relapse). Keep it under 200 characters and very motivating.`,
    });
    return response.text || "Treatment completion ensures full recovery and prevents future complications.";
  } catch (error) {
    console.error("Gemini context error:", error);
    return "Finishing your course is key to your long-term health.";
  }
}

export async function chatWithAssistant(history: {role: string, parts: {text: string}[]}[], message: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [...history, { role: "user", parts: [{ text: message }] }],
        config: {
          systemInstruction: "You are BIGUS AI, an AI Health Adherence Assistant. Your goal is to help patients stick to their treatment. You provide scientific explanations, friendly reminders, and clarify medical terms. Never give definitive diagnosis, always advise to consult a doctor for severe symptoms. Focus on EMPATHY and SCIENCE. You must act responsibly and professionally as an assistant built for BIGUS Health platform."
        }
      });
      return result.text || "I'm here to support your journey back to health. What's on your mind?";
    } catch (error: any) {
      if (error?.status === 429 && i < retries - 1) {
        // Wait exponentially: 1s, 2s, 4s...
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error("Gemini chat error:", error);
      return "I'm having a bit of trouble connecting to my medical database, but I'm still here for you.";
    }
  }
  return "I'm having a bit of trouble connecting to my medical database, but I'm still here for you.";
}
