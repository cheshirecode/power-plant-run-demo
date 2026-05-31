export function buildLeaderboardRows(rows, options = {}) {
  const scoreIncludesRound = options.scoreIncludesRound !== false;
  return [...(rows || [])]
    .map((row, index) => {
      const roundScore = roundScoreValue(row.roundScore);
      const totalScore = roundScoreValue(row.score);
      const previousScore =
        row.previousScore !== undefined
          ? roundScoreValue(row.previousScore)
          : scoreIncludesRound
            ? roundScoreValue(totalScore - roundScore)
            : totalScore;
      const displayTotal = scoreIncludesRound ? totalScore : roundScoreValue(previousScore + roundScore);
      return {
        ...row,
        rankSourceIndex: index,
        previousScore,
        roundScore,
        score: displayTotal,
      };
    })
    .sort((a, b) => b.score - a.score || b.roundScore - a.roundScore || a.rankSourceIndex - b.rankSourceIndex);
}

function roundScoreValue(value) {
  return Number(Number(value || 0).toFixed(2));
}
