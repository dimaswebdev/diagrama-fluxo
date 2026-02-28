'use server';
/**
 * @fileOverview A Genkit flow for summarizing evidence card content.
 *
 * - summarizeEvidenceCard - A function that generates a concise summary for detailed evidence.
 * - SummarizeEvidenceCardInput - The input type for the summarizeEvidenceCard function.
 * - SummarizeEvidenceCardOutput - The return type for the summarizeEvidenceCard function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeEvidenceCardInputSchema = z.object({
  evidenceContent: z.string().describe('The detailed content of the evidence card to be summarized.'),
});
export type SummarizeEvidenceCardInput = z.infer<typeof SummarizeEvidenceCardInputSchema>;

const SummarizeEvidenceCardOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the evidence card content.'),
});
export type SummarizeEvidenceCardOutput = z.infer<typeof SummarizeEvidenceCardOutputSchema>;

export async function summarizeEvidenceCard(input: SummarizeEvidenceCardInput): Promise<SummarizeEvidenceCardOutput> {
  return summarizeEvidenceCardFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeEvidenceCardPrompt',
  input: {schema: SummarizeEvidenceCardInputSchema},
  output: {schema: SummarizeEvidenceCardOutputSchema},
  prompt: `You are an AI assistant specialized in summarizing legal or investigative evidence.
Your goal is to provide a concise, factual, and objective summary of the provided evidence content.
The summary should capture the main points and key information, avoiding any subjective interpretation or unnecessary details.

Evidence Content:
"""{{{evidenceContent}}}"""

Provide a concise summary:
`,
});

const summarizeEvidenceCardFlow = ai.defineFlow(
  {
    name: 'summarizeEvidenceCardFlow',
    inputSchema: SummarizeEvidenceCardInputSchema,
    outputSchema: SummarizeEvidenceCardOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
