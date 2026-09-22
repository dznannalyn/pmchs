export function normalizeText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function detectSimilarAttempts(targetAttempt, attempts) {
  if (!targetAttempt) return [];

  const normalizedTarget = {
    deviceId: targetAttempt.deviceId || null,
    deviceFingerprint: targetAttempt.deviceFingerprint || null,
    userAgent: targetAttempt.userAgent || null,
    ipAddress: targetAttempt.ipAddress || null,
    studentName: targetAttempt.studentName || targetAttempt.userId || '',
    submittedAt: targetAttempt.submittedAt ? new Date(targetAttempt.submittedAt).getTime() : null
  };

  if (!normalizedTarget.submittedAt) return [];

  const matches = attempts
    .filter(attempt => attempt._id?.toString() !== targetAttempt._id?.toString())
    .map(attempt => {
      const attemptSubmittedAt = attempt.submittedAt ? new Date(attempt.submittedAt).getTime() : null;
      const minutesDifference = attemptSubmittedAt && normalizedTarget.submittedAt
        ? Math.abs((attemptSubmittedAt - normalizedTarget.submittedAt) / 60000)
        : Number.MAX_SAFE_INTEGER;

      let score = 0;
      const matchedFields = [];

      if (normalizedTarget.deviceId && attempt.deviceId && normalizedTarget.deviceId === attempt.deviceId) {
        score += 55;
        matchedFields.push('same device');
      }

      if (normalizedTarget.deviceFingerprint && attempt.deviceFingerprint && normalizedTarget.deviceFingerprint === attempt.deviceFingerprint) {
        score += 30;
        matchedFields.push('same browser fingerprint');
      }

      if (normalizedTarget.userAgent && attempt.userAgent && normalizedTarget.userAgent === attempt.userAgent) {
        score += 10;
        matchedFields.push('same browser');
      }

      if (normalizedTarget.ipAddress && attempt.ipAddress && normalizedTarget.ipAddress === attempt.ipAddress) {
        score += 20;
        matchedFields.push('same IP');
      }

      if (minutesDifference <= 15) {
        score += 15;
        matchedFields.push('same time window');
      }

      const targetName = normalizeText(normalizedTarget.studentName);
      const candidateName = normalizeText(attempt.userId || attempt.studentName || '');
      if (targetName && candidateName && targetName === candidateName) {
        score += 25;
        matchedFields.push('same name');
      }

      if (score >= 40) {
        return {
          id: attempt._id?.toString?.() || attempt.id || '',
          studentName: attempt.studentName || attempt.userId || 'Anonymous',
          score: attempt.score,
          totalQuestions: attempt.totalQuestions,
          submittedAt: attempt.submittedAt,
          similarityScore: score,
          matchedFields,
          linkLabel: attempt.linkLabel || null
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  return matches;
}
