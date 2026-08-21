import { tool } from "@langchain/core/tools";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

export const writeFileTool = tool(
    async ({ filePath, content }) => {
        try {
            const fullPath = path.resolve(filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
            console.log(`[write_file] Writing to: ${fullPath}`);
            return `File successfully written to ${filePath}`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    },
    {
        name: "write_file",
        description: "Write or update a file on the file system with given content.",
        schema: z.object({
            filePath: z.string().describe("Relative or absolute path to the file"),
            content: z.string().describe("The full code or text content to write"),
        }),
    }
);

export const readFileTool = tool(
    async ({ filePath }) => {
        try {
            const fullPath = path.resolve(filePath);
            const content = await fs.readFile(fullPath, "utf-8");
            return content;
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    },
    {
        name: "read_file",
        description: "Read the full text content of a file from the file system.",
        schema: z.object({
            filePath: z.string().describe("Path to the file to read"),
        }),
    }
);