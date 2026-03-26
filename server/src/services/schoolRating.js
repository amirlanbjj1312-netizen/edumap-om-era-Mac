const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const EXPERIENCE_TYPE_POINTS = {
  current_parent: 15,
  former_parent: 10,
  applicant_parent: 6,
  consultation_only: 5,
  other: 4,
};

const EXPERIENCE_FRESHNESS_POINTS = {
  current_year: 10,
  within_2_years: 7,
  within_5_years: 4,
  over_5_years: 2,
};

const QUESTION_CRITERIA_MAP = {
  quality_teachers: 'teaching',
  communication: 'communication',
  school_safety: 'safety',
  clubs_quality: 'atmosphere',
  value_for_money: 'value',
};

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const average = (values = []) => {
  const filtered = values.filter((value) => Number.isFinite(Number(value)));
  if (!filtered.length) return 0;
  const total = filtered.reduce((sum, value) => sum + Number(value), 0);
  return Number((total / filtered.length).toFixed(2));
};

const calculateSurveyAverage = (responses = [], questionById = new Map()) => {
  const allScores = responses.flatMap((response) => {
    if (!Array.isArray(response.answers)) return [];
    return response.answers
      .map((answer) => {
        const explicitScore = Number(answer?.score || 0);
        if (Number.isFinite(explicitScore) && explicitScore > 0) return explicitScore;
        const questionId = String(answer?.question_id || '').trim();
        const question = questionById.get(questionId);
        if (!question || question.type !== 'single_choice') return 0;
        const optionId = String(answer?.option_id || '').trim().toLowerCase();
        const optionLabel = String(answer?.option_label || '').trim().toLowerCase();
        const option = Array.isArray(question.options)
          ? question.options.find(
              (item) =>
                String(item?.id || '').trim().toLowerCase() === optionId ||
                String(item?.label || '').trim().toLowerCase() === optionLabel
            )
          : null;
        const optionScore = Number(option?.score || 0);
        if (!Number.isFinite(optionScore) || optionScore <= 0) return 0;
        return optionScore;
      })
      .filter((score) => Number.isFinite(score) && score > 0);
  });
  return average(allScores);
};

const mapSurveyResponseToEntry = (response = {}, questionById = new Map()) => {
  const criteria = {
    teaching: 0,
    communication: 0,
    safety: 0,
    atmosphere: 0,
    value: 0,
  };
  for (const answer of Array.isArray(response.answers) ? response.answers : []) {
    const questionId = String(answer?.question_id || '').trim();
    const criteriaKey = QUESTION_CRITERIA_MAP[questionId];
    if (!criteriaKey) continue;
    const question = questionById.get(questionId);
    let score = Number(answer?.score || 0);
    if ((!Number.isFinite(score) || score <= 0) && question?.type === 'single_choice') {
      const optionId = String(answer?.option_id || '').trim().toLowerCase();
      const optionLabel = String(answer?.option_label || '').trim().toLowerCase();
      const option = Array.isArray(question?.options)
        ? question.options.find(
            (item) =>
              String(item?.id || '').trim().toLowerCase() === optionId ||
              String(item?.label || '').trim().toLowerCase() === optionLabel
          )
        : null;
      score = Number(option?.score || 0);
    }
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;
    criteria[criteriaKey] = score;
  }
  return {
    source: 'survey',
    author_email: normalizeEmail(response?.user_email),
    experience_type: String(response?.experience_type || '').trim().toLowerCase(),
    experience_freshness: String(response?.experience_freshness || '').trim().toLowerCase(),
    verified_interaction: Boolean(response?.verified_interaction),
    criteria,
  };
};

const mapDirectReviewToEntry = (review = {}) => {
  const rawCriteria = review?.criteria || {};
  const criteria = {
    teaching: clamp(Number(rawCriteria.teaching || 0), 0, 5),
    communication: clamp(Number(rawCriteria.communication || 0), 0, 5),
    safety: clamp(Number(rawCriteria.safety || 0), 0, 5),
    atmosphere: clamp(Number(rawCriteria.atmosphere || 0), 0, 5),
    value: clamp(Number(rawCriteria.value || 0), 0, 5),
  };
  return {
    source: review?.status === 'published' ? 'review' : 'pending_review',
    author_email: normalizeEmail(review?.author_email),
    experience_type: String(review?.experience_type || '').trim().toLowerCase(),
    experience_freshness: String(review?.experience_freshness || '').trim().toLowerCase(),
    verified_interaction: Boolean(review?.verified_interaction),
    criteria,
  };
};

const collectFeedbackEntries = ({ school = {}, surveyResponses = [], questionById = new Map() }) => {
  const directReviews = [
    ...(Array.isArray(school?.reviews?.items) ? school.reviews.items : []),
    ...(Array.isArray(school?.reviews?.pending_items) ? school.reviews.pending_items : []),
  ].filter((item) => item?.criteria);
  return [
    ...surveyResponses.map((response) => mapSurveyResponseToEntry(response, questionById)),
    ...directReviews.map(mapDirectReviewToEntry),
  ].filter((entry) =>
    Object.values(entry.criteria || {}).some((score) => Number(score) >= 1 && Number(score) <= 5)
  );
};

const calculateExperiencePoints = (entries = []) => {
  if (!entries.length) return { experienceType: 0, freshness: 0 };
  return {
    experienceType: average(
      entries.map((entry) => EXPERIENCE_TYPE_POINTS[entry.experience_type] || 0)
    ),
    freshness: average(
      entries.map((entry) => EXPERIENCE_FRESHNESS_POINTS[entry.experience_freshness] || 0)
    ),
  };
};

const calculateVerificationPoints = ({ entries = [], consultations = [], schoolId = '' }) => {
  if (!entries.length) return 0;
  const normalizedSchoolId = String(schoolId || '').trim().toLowerCase();
  return average(
    entries.map((entry) => {
      const hasConsultation = consultations.some(
        (item) =>
          normalizeEmail(item?.parentEmail || '') === entry.author_email &&
          String(item?.schoolId || '').trim().toLowerCase() === normalizedSchoolId
      );
      if (hasConsultation || entry.verified_interaction) return 10;
      if (entry.experience_type === 'current_parent' || entry.experience_type === 'former_parent') return 6;
      if (entry.experience_type === 'applicant_parent' || entry.experience_type === 'consultation_only') return 4;
      return 2;
    })
  );
};

const calculateRatingBreakdown = ({ school = {}, surveyResponses = [], questionById = new Map() }) => {
  const entries = collectFeedbackEntries({ school, surveyResponses, questionById });
  const criteriaScores = {
    teaching: entries.map((entry) => entry.criteria.teaching).filter((score) => score >= 1),
    communication: entries.map((entry) => entry.criteria.communication).filter((score) => score >= 1),
    safety: entries.map((entry) => entry.criteria.safety).filter((score) => score >= 1),
    atmosphere: entries.map((entry) => entry.criteria.atmosphere).filter((score) => score >= 1),
    value: entries.map((entry) => entry.criteria.value).filter((score) => score >= 1),
  };
  const criteria = {
    teaching: average(criteriaScores.teaching),
    communication: average(criteriaScores.communication),
    safety: average(criteriaScores.safety),
    atmosphere: average(criteriaScores.atmosphere),
    value: average(criteriaScores.value),
  };
  const combinedAverage = average(Object.values(criteria).filter((score) => score > 0));
  return {
    entries,
    criteria,
    combinedAverage,
    feedbackCount: entries.length,
    surveyCount: surveyResponses.length,
    publishedReviewCount: Array.isArray(school?.reviews?.items) ? school.reviews.items.length : 0,
  };
};

const calculateCompositeRating = ({
  school = {},
  surveyResponses = [],
  consultations = [],
  questionById = new Map(),
  popularityCount = 0,
  schoolId = '',
}) => {
  const breakdown = calculateRatingBreakdown({ school, surveyResponses, questionById });
  const surveyPoints = Number(((breakdown.combinedAverage / 5) * 60).toFixed(2));
  const experiencePoints = calculateExperiencePoints(breakdown.entries);
  const verificationPoints = calculateVerificationPoints({
    entries: breakdown.entries,
    consultations,
    schoolId,
  });
  const popularityPoints = Number(
    clamp(Math.log10(Math.max(0, Number(popularityCount) || 0) + 1) * 2 + 1, 0, 5).toFixed(2)
  );
  const totalPoints = clamp(
    surveyPoints +
      experiencePoints.experienceType +
      experiencePoints.freshness +
      verificationPoints +
      popularityPoints,
    0,
    100
  );
  return {
    rating: Number((totalPoints / 20).toFixed(1)),
    total_points: Number(totalPoints.toFixed(2)),
    survey_average: breakdown.combinedAverage,
    points: {
      survey: surveyPoints,
      experience_type: experiencePoints.experienceType,
      freshness: experiencePoints.freshness,
      verification: verificationPoints,
      popularity: popularityPoints,
    },
    breakdown: {
      criteria: breakdown.criteria,
      feedback_count: breakdown.feedbackCount,
      survey_count: breakdown.surveyCount,
      reviews_published_count: breakdown.publishedReviewCount,
    },
  };
};

module.exports = {
  calculateSurveyAverage,
  calculateCompositeRating,
};
