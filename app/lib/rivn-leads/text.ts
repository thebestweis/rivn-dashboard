export type KeywordMatchType = "contains" | "exact" | "fuzzy";

export type KeywordCandidate = {
  id: string;
  value: string;
  normalized_value: string;
  match_type: KeywordMatchType;
};

export type StopWordCandidate = {
  id: string;
  value: string;
  normalized_value: string;
};

export function normalizeLeadText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\u0451/g, "\u0435")
    .replace(/[^\p{L}\p{N}\s@._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchLeadKeywords(normalizedText: string, keywords: KeywordCandidate[]) {
  return keywords
    .filter((keyword) => keywordMatches(normalizedText, keyword.normalized_value, keyword.match_type))
    .map((keyword) => ({
      keywordId: keyword.id,
      value: keyword.value,
      matchType: keyword.match_type,
    }));
}

export function findLeadStopWords(normalizedText: string, stopWords: StopWordCandidate[]) {
  return stopWords
    .filter((stopWord) => containsPhrase(normalizedText, stopWord.normalized_value))
    .map((stopWord) => ({
      stopWordId: stopWord.id,
      value: stopWord.value,
    }));
}

function keywordMatches(normalizedText: string, normalizedKeyword: string, matchType: KeywordMatchType) {
  const keyword = normalizeLeadText(normalizedKeyword);

  if (!keyword) return false;
  if (matchType === "contains") return containsKeyword(normalizedText, keyword);
  if (matchType === "exact") return exactPhrase(normalizedText, keyword);

  return containsKeyword(normalizedText, keyword) || fuzzyPhrase(normalizedText, keyword);
}

function containsPhrase(normalizedText: string, normalizedPhrase: string) {
  const phrase = normalizeLeadText(normalizedPhrase);
  if (!phrase) return false;
  return normalizedText.includes(phrase);
}

function containsKeyword(normalizedText: string, normalizedKeyword: string) {
  if (isShortCyrillicKeyword(normalizedKeyword) || isShortNumericKeyword(normalizedKeyword)) {
    return exactPhrase(normalizedText, normalizedKeyword);
  }

  return containsPhrase(normalizedText, normalizedKeyword);
}

function exactPhrase(normalizedText: string, normalizedPhrase: string) {
  const phrase = normalizeLeadText(normalizedPhrase);
  if (!phrase) return false;

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "u").test(normalizedText);
}

function isShortCyrillicKeyword(value: string) {
  return /^[\u0430-\u044f]{1,3}$/u.test(value);
}

function isShortNumericKeyword(value: string) {
  return /^\d{1,3}$/u.test(value);
}

function fuzzyPhrase(normalizedText: string, normalizedPhrase: string) {
  const textTokens = normalizedText.split(" ").filter(Boolean);
  const phrase = normalizeLeadText(normalizedPhrase);
  const phraseTokens = phrase.split(" ").filter(Boolean);
  if (phraseTokens.length === 0 || textTokens.length === 0) return false;

  const windowSize = phraseTokens.length;
  for (let index = 0; index <= textTokens.length - windowSize; index += 1) {
    const window = textTokens.slice(index, index + windowSize).join(" ");
    const maxDistance = Math.max(1, Math.floor(phrase.length * 0.2));
    if (levenshteinDistance(window, phrase) <= maxDistance) return true;
  }

  return false;
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + cost
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}
