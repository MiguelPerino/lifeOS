import type { z } from "zod";
export interface AIProvider {
  generate(system: string, prompt: string): Promise<string>;
  generateStructured<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T>;
  embed(text: string, purpose?: "document" | "query"): Promise<number[]>;
}
