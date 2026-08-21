import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

const useLocalLLM = process.env.USE_LOCAL_LLM === "true";
const localBaseUrl = process.env.LOCAL_LLM_BASE_URL ?? "http://localhost:8000/v1";
const localModelName = process.env.LOCAL_LLM_MODEL ?? "Qwen/Qwen2.5-Coder-1.5B";

export function getLLM(): BaseChatModel {
    if (useLocalLLM) {
        console.log(`🤖 Using Local vLLM Model: ${localModelName} (${localBaseUrl})`);
        return new ChatOpenAI({
            modelName: localModelName,
            temperature: 0.2,
            configuration: {
                baseURL: localBaseUrl,
            },
            openAIApiKey: "EMPTY",
        });
    }

    console.log(`☁️ Using Google Gemini API: gemini-2.5-flash`);
    return new ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash",
        apiKey: process.env.GEMINI_API_KEY ?? "",
        temperature: 0.2,
    });
}

export const model = getLLM();
export const geminiModel = model;