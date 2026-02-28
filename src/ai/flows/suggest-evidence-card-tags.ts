'use server';
/**
 * @fileOverview A Genkit flow for suggesting relevant tags for an evidence card.
 *
 * - suggestEvidenceCardTags - A function that suggests tags based on card content.
 * - SuggestEvidenceCardTagsInput - The input type for the suggestEvidenceCardTags function.
 * - SuggestEvidenceCardTagsOutput - The return type for the suggestEvidenceCardTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestEvidenceCardTagsInputSchema = z.object({
  content: z
    .string()
    .describe('The text content of the evidence card.'),
});
export type SuggestEvidenceCardTagsInput = z.infer<
  typeof SuggestEvidenceCardTagsInputSchema
>;

const SuggestEvidenceCardTagsOutputSchema = z.object({
  tags: z.array(z.string()).describe('An array of suggested tags for the card content.'),
});
export type SuggestEvidenceCardTagsOutput = z.infer<
  typeof SuggestEvidenceCardTagsOutputSchema
>;

export async function suggestEvidenceCardTags(
  input: SuggestEvidenceCardTagsInput
): Promise<SuggestEvidenceCardTagsOutput> {
  return suggestEvidenceCardTagsFlow(input);
}

const suggestEvidenceCardTagsPrompt = ai.definePrompt({
  name: 'suggestEvidenceCardTagsPrompt',
  input: {schema: SuggestEvidenceCardTagsInputSchema},
  output: {schema: SuggestEvidenceCardTagsOutputSchema},
  prompt: `You are an AI assistant specialized in organizing evidence and identifying key themes.

Based on the following evidence card content, suggest 3-5 concise and relevant tags. The tags should help categorize the information for easy searching and retrieval.

Ensure the output is a JSON object with a single key 'tags' containing an array of strings. Do not include any other text or formatting.

Evidence Card Content:
"""{{{content}}}"""

Example Output:
{
  "tags": ["criminal", "document", "timestamp"]
}
`,
});

const suggestEvidenceCardTagsFlow = ai.defineFlow(
  {
    name: 'suggestEvidenceCardTagsFlow',
    inputSchema: SuggestEvidenceCardTagsInputSchema,
    outputSchema: SuggestEvidenceCardTagsOutputSchema,
  },
  async (input) => {
    const {output} = await suggestEvidenceCardTagsPrompt(input);
    return output!;
  }
);
