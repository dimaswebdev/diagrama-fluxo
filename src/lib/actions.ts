'use server';

import {
  summarizeEvidenceCard,
  SummarizeEvidenceCardInput,
} from '@/ai/flows/summarize-evidence-card';
import {
  suggestEvidenceCardTags,
  SuggestEvidenceCardTagsInput,
} from '@/ai/flows/suggest-evidence-card-tags';

export async function generateSummary(input: SummarizeEvidenceCardInput) {
  const result = await summarizeEvidenceCard(input);
  return result.summary;
}

export async function generateTags(input: SuggestEvidenceCardTagsInput) {
  const result = await suggestEvidenceCardTags(input);
  return result.tags;
}
