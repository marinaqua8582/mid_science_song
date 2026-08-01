/**
 * Simple token-level LCS diff algorithm for comparing AI generated lyrics and student edited lyrics
 */

export interface LyricsDiffChunk {
  text: string;
  isModified: boolean;
}

export function diffLyrics(original: string = '', edited: string = ''): LyricsDiffChunk[] {
  if (!original && !edited) return [];
  if (!original) return [{ text: edited, isModified: true }];
  if (!edited) return [];
  if (original.trim() === edited.trim()) {
    return [{ text: edited, isModified: false }];
  }

  // Tokenize preserving whitespaces and newlines
  const tokenize = (str: string) => str.match(/\S+|\s+/g) || [];
  const origTokens = tokenize(original);
  const editTokens = tokenize(edited);

  const m = origTokens.length;
  const n = editTokens.length;

  // DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origTokens[i - 1] === editTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Track matched tokens in editTokens
  const isMatched = new Array(n).fill(false);
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (origTokens[i - 1] === editTokens[j - 1]) {
      isMatched[j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Build chunks
  const chunks: LyricsDiffChunk[] = [];
  let currentText = '';
  let currentModified = false;

  for (let idx = 0; idx < editTokens.length; idx++) {
    const token = editTokens[idx];
    const isTokenMatched = isMatched[idx];
    const isWhitespace = /^\s+$/.test(token);

    // Whitespace token modified flag
    let modified = !isTokenMatched;
    if (isWhitespace && idx > 0 && idx < editTokens.length - 1) {
      if (isMatched[idx - 1] && isMatched[idx + 1]) {
        modified = false;
      }
    }

    if (idx === 0) {
      currentText = token;
      currentModified = modified;
    } else if (modified === currentModified) {
      currentText += token;
    } else {
      chunks.push({ text: currentText, isModified: currentModified });
      currentText = token;
      currentModified = modified;
    }
  }

  if (currentText) {
    chunks.push({ text: currentText, isModified: currentModified });
  }

  return chunks;
}
