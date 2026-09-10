const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "did", "do", "does", "doing", "don't", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
  "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't",
  "it", "its", "itself", "let's", "me", "more", "most", "my", "myself", "no", "nor",
  "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such",
  "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "were", "weren't", "what", "when", "where", "which",
  "while", "who", "whom", "why", "with", "won't", "would", "you", "your", "yours"
]);

/**
 * Tokenizes and normalizes an input string into a Set of lowercased tokens.
 * Strips punctuation and filters out English stop words and short tokens.
 */
export function tokenizeText(text: string): Set<string> {
  if (!text) return new Set();

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/);

  const tokens = new Set<string>();
  for (const word of words) {
    const cleaned = word.trim();
    if (cleaned.length >= 2 && !STOP_WORDS.has(cleaned)) {
      tokens.add(cleaned);
    }
  }

  return tokens;
}

/**
 * Computes Jaccard Similarity between two token sets:
 * J(A, B) = |A ∩ B| / |A ∪ B|
 * Returns a score between 0.0 and 1.0.
 */
export function calculateJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  if (unionSize === 0) return 0;

  return intersectionCount / unionSize;
}

export interface ComplaintTextContent {
  title: string;
  description: string;
  locationContext?: string;
}

/**
 * Combines complaint fields (title, description, locationContext) into normalized tokens.
 */
export function extractComplaintTokens(complaint: ComplaintTextContent): Set<string> {
  const combinedText = `${complaint.title} ${complaint.description} ${complaint.locationContext || ""}`;
  return tokenizeText(combinedText);
}

/**
 * Calculates similarity score between a complaint and candidate text/complaint.
 */
export function computeComplaintSimilarity(
  source: ComplaintTextContent,
  candidate: ComplaintTextContent
): number {
  const sourceTokens = extractComplaintTokens(source);
  const candidateTokens = extractComplaintTokens(candidate);
  return calculateJaccardSimilarity(sourceTokens, candidateTokens);
}
