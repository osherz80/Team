import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { geminiModel } from "./llm.ts";
import { writeFileTool, readFileTool } from "./tools.ts";
import type { AgentStateType } from "./state.ts";

const SYSTEM_PROMPT = `You are an expert Full-Stack Software Engineer.
Your job is to implement subtasks by creating or updating files in the project workspace.

IMPORTANT TOOL INSTRUCTIONS:
1. Always invoke the 'write_file' tool to write or create files on disk for every task.
2. Whenever you output code or content in text, always include a header specifying the target file path, e.g.:
   // File: src/auth/jwt.ts
   or
   <!-- File: docs/architecture.md -->
3. If invoking 'write_file', format JSON arguments cleanly with proper string escaping.`;

const coderAgent = createReactAgent({
    llm: geminiModel,
    tools: [writeFileTool, readFileTool],
    prompt: SYSTEM_PROMPT,
});

export const coderPrompt = (subtask: string, dod: string) => `
You are an expert Full-Stack Software Engineer equipped with file system tools (read_file, write_file).
Your current task is: ${subtask}
Definition of Done (DOD): ${dod}

Instructions:
1. Analyze what files need to be created or updated for this subtask.
2. Use the 'write_file' tool to create or update the required files in the workspace (e.g. src/ or docs/ directory).
3. Always specify the relative file path clearly, and put a file header line at the start of any code blocks, e.g.: // File: src/server.ts
4. Verify that the written code strictly matches the Definition of Done (DOD).
5. Provide a summary of all files created/modified and explain how the solution meets the DOD.
`;

/**
 * Fallback parser when LLM / vLLM tool call parser fails (e.g. hermes_tool_parser JSONDecodeError)
 * or when LLM outputs code blocks directly in text without calling the native tool API.
 */
export async function extractAndWriteFilesFallback(
    text: string,
    subtaskTitle: string,
    taskIndex: number
): Promise<string[]> {
    const savedFiles: string[] = [];

    // 1. Check for raw <tool_call> tags in response text
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
    let match;
    while ((match = toolCallRegex.exec(text)) !== null) {
        const rawJson = match[1]!.trim();
        try {
            const parsed = JSON.parse(rawJson);
            const args = parsed.arguments || parsed.parameters || parsed;
            if (args.filePath && args.content) {
                await writeFileTool.invoke({ filePath: args.filePath, content: args.content });
                savedFiles.push(args.filePath);
            }
        } catch (e) {
            // Attempt to repair unescaped newlines in JSON string values
            try {
                const fixedJson = rawJson.replace(/":\s*"([\s\S]*?)"\s*([,}])/g, (_, val, end) => {
                    const escapedVal = val.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
                    return `": "${escapedVal}"${end}`;
                });
                const parsed = JSON.parse(fixedJson);
                const args = parsed.arguments || parsed.parameters || parsed;
                if (args.filePath && args.content) {
                    await writeFileTool.invoke({ filePath: args.filePath, content: args.content });
                    savedFiles.push(args.filePath);
                }
            } catch (err) {
                // Ignore parse errors, proceed to code block extraction
            }
        }
    }

    if (savedFiles.length > 0) {
        return savedFiles;
    }

    // 2. Extract code blocks (```lang ... ```)
    const codeBlockRegex = /(?:([^\n]+)\n)?```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let blockMatch;
    let blockCount = 0;

    while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
        blockCount++;
        const precedingLine = (blockMatch[1] || "").trim();
        const lang = (blockMatch[2] || "").toLowerCase();
        const codeContent = blockMatch[3];

        let filePath = "";

        // Check first 5 lines of code block content for file path header comment
        const codeLines = codeContent!.split("\n");
        for (let i = 0; i < Math.min(5, codeLines.length); i++) {
            const line = codeLines[i]!.trim();
            const fileMatch = line.match(/(?:(?:\/\/|#|<!--|\/\*)\s*)?(?:file|filepath|path):\s*([^\s*-->]+)/i);
            if (fileMatch) {
                filePath = fileMatch[1]!.trim();
                break;
            }
        }

        // Check preceding line if not found inside code block
        if (!filePath && precedingLine) {
            const fileMatch = precedingLine.match(/(?:file|filepath|created|in|to)\s*[`"']?([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)[`"']?/i);
            if (fileMatch) {
                filePath = fileMatch[1]!.trim();
            }
        }

        // Fallback file path if none was explicitly mentioned
        if (!filePath) {
            const slug = subtaskTitle
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "")
                .slice(0, 30);

            let ext = "ts";
            if (lang === "json") ext = "json";
            else if (lang === "markdown" || lang === "md") ext = "md";
            else if (lang === "html") ext = "html";
            else if (lang === "css") ext = "css";
            else if (lang === "sql") ext = "sql";
            else if (lang === "yaml" || lang === "yml") ext = "yml";
            else if (lang === "js" || lang === "javascript") ext = "js";

            const folder = (lang === "markdown" || lang === "md") ? "docs" : "src";
            filePath = blockCount === 1 ? `${folder}/${slug}.${ext}` : `${folder}/${slug}_${blockCount}.${ext}`;
        }

        // Clean quotes or colons from filePath
        filePath = filePath.replace(/[`'":]/g, "");

        await writeFileTool.invoke({ filePath, content: codeContent! });
        savedFiles.push(filePath);
    }

    return savedFiles;
}

export const coderNode = async (state: AgentStateType) => {
    const { subtasks, currentTaskIndex } = state;
    const currentTask = subtasks[currentTaskIndex];

    if (!currentTask) {
        console.log(`\n💻 [Coder] No task found at index ${currentTaskIndex}.`);
        return {};
    }

    console.log(`\n💻 [Coder] Executing task ${currentTaskIndex + 1}/${subtasks.length}: "${currentTask.title}"`);
    console.log(`   DOD: ${currentTask.dod}`);

    const result = await coderAgent.invoke({
        messages: [{ role: "user", content: coderPrompt(currentTask.title, currentTask.dod) }],
    });

    const toolMessages = result.messages.filter((m: any) => m._getType() === "tool");
    console.log(`🔍 [Coder Debug] Total tool executions: ${toolMessages.length}`);

    toolMessages.forEach((tm: any, i: number) => {
        console.log(`   └─ Tool Call ${i + 1} (${tm.name}): ${tm.content}`);
    });

    const lastMessage = result.messages?.[result.messages.length - 1];
    const codeOutput = lastMessage && typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? "");

    // If native tool call execution was 0 (e.g. vLLM hermes_tool_parser JSONDecodeError or standard text output),
    // trigger fallback code block parser to guarantee files are written to disk.
    if (toolMessages.length === 0) {
        const fallbackSavedFiles = await extractAndWriteFilesFallback(
            codeOutput,
            currentTask.title,
            currentTaskIndex
        );
        if (fallbackSavedFiles.length > 0) {
            console.log(`⚠️ [Coder Fallback] Extracted and saved ${fallbackSavedFiles.length} file(s) from model response:`);
            fallbackSavedFiles.forEach((file) => {
                console.log(`   └─ Wrote file to disk: ${file}`);
            });
        }
    }

    const updatedSubtasks = [...subtasks];
    updatedSubtasks[currentTaskIndex] = {
        ...currentTask,
        status: "completed",
        codeOutput,
    };

    console.log(`✅ [Coder] Task ${currentTaskIndex + 1} completed.`);

    return {
        subtasks: updatedSubtasks,
        currentTaskIndex: currentTaskIndex + 1,
    };
};