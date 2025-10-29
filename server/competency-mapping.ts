/**
 * Qualification-Competency Mapping System
 * 
 * This file defines how qualifications (courses) and activities (work experiences) 
 * impact the 11 OBT competencies.
 * Each mapping includes keywords to match and the competency impact weights.
 */

export interface CompetencyImpact {
  competencyId: string;
  weight: number; // 1-5, where 1=low impact, 5=high impact
}

export interface ActivityType {
  type: string;
  impacts: CompetencyImpact[];
  yearsMultiplier?: number; // Optional multiplier based on years of experience
}

export interface QualificationPattern {
  keywords: string[]; // Keywords to match in course title (case-insensitive)
  impacts: CompetencyImpact[];
}

/**
 * Qualification patterns that affect the new 11-competency framework
 * STRICT MATCHING: Each pattern focuses on PRIMARY competency only
 * Secondary impacts removed to prevent over-crediting
 */
export const QUALIFICATION_PATTERNS: QualificationPattern[] = [
  // Interpersonal & Team Leadership Skills - STRICT
  {
    keywords: ['leadership', 'team building', 'conflict resolution', 'active listening', 'group dynamics', 'team leadership'],
    impacts: [
      { competencyId: 'interpersonal_skills', weight: 5 },
    ]
  },
  
  // Cross-cultural & Intercultural Communication - STRICT
  {
    keywords: ['cross-cultural', 'intercultural', 'cultural sensitivity', 'anthropology', 'ethnography', 'cultural adaptation'],
    impacts: [
      { competencyId: 'intercultural_communication', weight: 5 },
    ]
  },
  
  // Oral Communication & Multimodal Methods - STRICT (must have "oral" or "multimodal")
  {
    keywords: ['oral bible translation', 'obt training', 'storytelling methods', 'multimodal', 'embodied learning', 'oral communication methods'],
    impacts: [
      { competencyId: 'multimodal_skills', weight: 5 },
    ]
  },
  
  // Translation Theory - STRICT (translation-specific courses only)
  {
    keywords: ['translation theory', 'translation principles', 'translation methods', 'bible translation', 'translation studies'],
    impacts: [
      { competencyId: 'translation_theory', weight: 5 },
    ]
  },
  
  // Languages & Communication - STRICT (linguistics focus)
  {
    keywords: ['linguistics', 'applied linguistics', 'semantics', 'pragmatics', 'discourse analysis', 'language structure', 'phonetics', 'phonology', 'morphology', 'syntax'],
    impacts: [
      { competencyId: 'languages_communication', weight: 5 },
    ]
  },
  
  // Biblical Languages - VERY STRICT (original languages only)
  {
    keywords: ['biblical hebrew', 'biblical greek', 'koine greek', 'aramaic', 'original languages', 'hebrew exegesis', 'greek exegesis'],
    impacts: [
      { competencyId: 'biblical_languages', weight: 5 },
    ]
  },
  
  // Biblical Studies & Theology - STRICTER (require theology/biblical study focus)
  {
    keywords: ['theology', 'theological studies', 'biblical studies', 'hermeneutics', 'biblical interpretation', 'biblical theology', 'systematic theology'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 5 },
    ]
  },
  
  // Planning & Quality Assurance - STRICT
  {
    keywords: ['project management', 'quality assurance', 'qa training', 'quality control', 'project planning', 'translation consultant'],
    impacts: [
      { competencyId: 'planning_quality', weight: 5 },
    ]
  },
  
  // Consulting & Mentoring - STRICT
  {
    keywords: ['mentoring', 'mentorship training', 'coaching', 'consulting', 'translation consultant', 'mentor training', 'discipleship training'],
    impacts: [
      { competencyId: 'consulting_mentoring', weight: 5 },
    ]
  },
  
  // Applied Technology - STRICT
  {
    keywords: ['audio technology', 'recording technology', 'digital tools', 'software training', 'technology for translation', 'digital literacy', 'computer science'],
    impacts: [
      { competencyId: 'applied_technology', weight: 5 },
    ]
  },
  
  // Reflective Practice - STRICT
  {
    keywords: ['reflective practice', 'self-awareness training', 'emotional intelligence', 'personal development', 'leadership development'],
    impacts: [
      { competencyId: 'reflective_practice', weight: 5 },
    ]
  },
  
  // YWAM DTS - Special case (genuinely multi-competency)
  {
    keywords: ['dts', 'discipleship training school'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 3 },
      { competencyId: 'intercultural_communication', weight: 2 },
    ]
  },
];

/**
 * Activity type mappings to competencies
 * STRICT FOCUS: Each activity type impacts only 1-2 primary competencies
 * Removed secondary impacts to prevent over-crediting
 */
export const ACTIVITY_TYPE_IMPACTS: Record<string, CompetencyImpact[]> = {
  'translation': [
    { competencyId: 'translation_theory', weight: 4 },
    { competencyId: 'multimodal_skills', weight: 2 },
  ],
  'facilitation': [
    { competencyId: 'interpersonal_skills', weight: 4 },
    { competencyId: 'consulting_mentoring', weight: 3 },
  ],
  'teaching': [
    { competencyId: 'consulting_mentoring', weight: 4 },
  ],
  'indigenous_work': [
    { competencyId: 'intercultural_communication', weight: 5 },
  ],
  'school_work': [
    { competencyId: 'interpersonal_skills', weight: 2 },
  ],
  'general_experience': [
    { competencyId: 'reflective_practice', weight: 1 },
  ],
};

/**
 * Get multiplier based on course level
 * Designed so that:
 * - 1 Bachelor degree = Proficient (15 points)
 * - 1 Master degree = Advanced (22 points)
 * - introduction: 0.5x (2.5 points - basic awareness)
 * - certificate: 1.2x (6 points - baseline competency)
 * - bachelor: 3.0x (15 points - proficient level)
 * - master: 4.4x (22 points - advanced level)
 * - doctoral: 5.0x (25 points - expert level)
 */
export function getCourseLevelMultiplier(courseLevel?: string | null): number {
  switch (courseLevel) {
    case 'introduction': return 0.5;
    case 'certificate': return 1.2;
    case 'bachelor': return 3.0;
    case 'master': return 4.4;
    case 'doctoral': return 5.0;
    default: return 1.2; // Default to certificate level if not specified
  }
}

/**
 * Calculate competency impacts for a given qualification
 */
export function calculateQualificationImpacts(
  courseTitle: string,
  description?: string | null,
  courseLevel?: string | null
): Map<string, number> {
  const impacts = new Map<string, number>();
  const searchText = `${courseTitle} ${description || ''}`.toLowerCase();
  const levelMultiplier = getCourseLevelMultiplier(courseLevel);
  
  // Check each pattern
  for (const pattern of QUALIFICATION_PATTERNS) {
    // Check if any keyword matches
    const matches = pattern.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (matches) {
      // Add this pattern's impacts with course level multiplier
      for (const impact of pattern.impacts) {
        const currentWeight = impacts.get(impact.competencyId) || 0;
        impacts.set(impact.competencyId, currentWeight + (impact.weight * levelMultiplier));
      }
    }
  }
  
  return impacts;
}

/**
 * Convert accumulated weight to competency status level
 * Thresholds:
 * - 0: not_started
 * - 1-5: emerging
 * - 6-12: growing  
 * - 13-20: proficient
 * - 21+: advanced
 */
export function scoreToStatus(score: number): string {
  if (score === 0) return 'not_started';
  if (score <= 5) return 'emerging';
  if (score <= 12) return 'growing';
  if (score <= 20) return 'proficient';
  return 'advanced';
}

/**
 * Calculate competency impacts for a given activity/experience
 */
export function calculateActivityImpacts(
  activityType: string | null,
  yearsOfExperience?: number | null,
  description?: string | null,
  chaptersCount?: number | null,
  durationYears?: number | null,
  durationMonths?: number | null
): Map<string, number> {
  const impacts = new Map<string, number>();
  
  // Default to general_experience for activities without explicit type
  // This avoids mis-scoring and is safer than inferring type from other fields
  // Legacy translation activities should be re-added with explicit activityType
  const type = activityType || 'general_experience';
  
  // Get base impacts for this activity type
  const baseImpacts = ACTIVITY_TYPE_IMPACTS[type] || ACTIVITY_TYPE_IMPACTS['general_experience'];
  
  // Calculate multiplier based on YEARS OF EXPERIENCE (primary measure)
  // Support BOTH old field (yearsOfExperience) and new fields (durationYears + durationMonths)
  // Chapters are NOT used as a general multiplier for all competencies
  let multiplier = 1;
  
  // Calculate total years from EITHER yearsOfExperience OR durationYears/Months
  let totalYears = 0;
  if (durationYears !== null && durationYears !== undefined) {
    // NEW format: Use durationYears + (durationMonths/12) for precise calculation
    totalYears = durationYears + ((durationMonths || 0) / 12);
  } else if (yearsOfExperience && yearsOfExperience > 0) {
    // OLD format: Fallback to yearsOfExperience for backwards compatibility
    totalYears = yearsOfExperience;
  }
  
  if (totalYears > 0) {
    // Scale: 1 year = 1.0x, 2 years = 1.2x, 3 years = 1.4x, 5+ years = 2.0x
    multiplier = Math.min(1 + (totalYears - 1) * 0.2, 2.0);
  }
  
  // Apply base impacts with years multiplier
  for (const impact of baseImpacts) {
    impacts.set(impact.competencyId, impact.weight * multiplier);
  }
  
  // TRANSLATION-SPECIFIC BONUS: Add small chapter bonus ONLY for translation_theory
  // Chapters measure translation work volume, not general competency
  if (type === 'translation' && chaptersCount && chaptersCount > 0) {
    const current = impacts.get('translation_theory') || 0;
    let chapterBonus = 0;
    
    // Small bonus based on chapters: 1-10 = +0.5, 11-30 = +1, 31-60 = +1.5, 60+ = +2
    if (chaptersCount >= 60) chapterBonus = 2;
    else if (chaptersCount >= 31) chapterBonus = 1.5;
    else if (chaptersCount >= 11) chapterBonus = 1;
    else chapterBonus = 0.5;
    
    impacts.set('translation_theory', current + chapterBonus);
  }
  
  // NO keyword-based boosts from descriptions - rely only on activityType
  // This prevents over-crediting and ensures users must choose correct activity type
  
  return impacts;
}

/**
 * Calculate all competency scores for a facilitator based on their qualifications and activities
 * Returns both total scores and separate education/experience scores for two-pillar analysis
 */
export function calculateCompetencyScores(
  qualifications: Array<{ courseTitle: string; description?: string | null; courseLevel?: string | null }>,
  activities?: Array<{ 
    activityType?: string | null; 
    yearsOfExperience?: number | null;
    description?: string | null;
    chaptersCount?: number | null;
    durationYears?: number | null;
    durationMonths?: number | null;
  }>
): {
  total: Map<string, number>;
  education: Map<string, number>;
  experience: Map<string, number>;
} {
  const educationScores = new Map<string, number>();
  const experienceScores = new Map<string, number>();
  
  // Process each qualification (education pillar)
  for (const qualification of qualifications) {
    const impacts = calculateQualificationImpacts(
      qualification.courseTitle,
      qualification.description,
      qualification.courseLevel
    );
    
    // Accumulate impacts into education scores
    const impactEntries = Array.from(impacts.entries());
    for (const [competencyId, weight] of impactEntries) {
      const currentScore = educationScores.get(competencyId) || 0;
      educationScores.set(competencyId, currentScore + weight);
    }
  }
  
  // Process each activity (experience pillar)
  if (activities) {
    for (const activity of activities) {
      const impacts = calculateActivityImpacts(
        activity.activityType || null,
        activity.yearsOfExperience || null,
        activity.description || null,
        activity.chaptersCount || null,
        activity.durationYears || null,
        activity.durationMonths || null
      );
      
      // Accumulate impacts into experience scores
      const impactEntries = Array.from(impacts.entries());
      for (const [competencyId, weight] of impactEntries) {
        const currentScore = experienceScores.get(competencyId) || 0;
        experienceScores.set(competencyId, currentScore + weight);
      }
    }
  }
  
  // Calculate total scores (education + experience)
  const totalScores = new Map<string, number>();
  const allCompetencyIds = new Set([...educationScores.keys(), ...experienceScores.keys()]);
  
  for (const competencyId of allCompetencyIds) {
    const educationScore = educationScores.get(competencyId) || 0;
    const experienceScore = experienceScores.get(competencyId) || 0;
    totalScores.set(competencyId, educationScore + experienceScore);
  }
  
  return {
    total: totalScores,
    education: educationScores,
    experience: experienceScores,
  };
}

/**
 * Conversation keywords mapping to competencies
 * Used to detect which competencies are being discussed in conversation
 */
const CONVERSATION_COMPETENCY_KEYWORDS: Record<string, string[]> = {
  'interpersonal_skills': [
    'leadership', 'team', 'listening', 'empathy', 'facilitation', 'conflict', 'relationship',
    'communication', 'collaboration', 'mediation', 'trust', 'group dynamics', 'active listening'
  ],
  'intercultural_communication': [
    'cultural', 'culture', 'cross-cultural', 'intercultural', 'respect', 'adaptation',
    'sensitivity', 'ethnography', 'anthropology', 'worldview', 'customs', 'traditions'
  ],
  'multimodal_skills': [
    'oral', 'storytelling', 'story', 'gesture', 'visual', 'embodied', 'drama', 'song',
    'performance', 'narrative', 'multimodal', 'spoken', 'voice', 'demonstration'
  ],
  'translation_theory': [
    'translation', 'meaning', 'equivalence', 'accuracy', 'faithfulness', 'natural',
    'receptor language', 'source language', 'translating', 'back-translation', 'consultant check'
  ],
  'languages_communication': [
    'language', 'linguistic', 'grammar', 'vocabulary', 'semantics', 'discourse', 'metaphor',
    'idiom', 'pragmatics', 'syntax', 'phonology', 'morphology', 'word order'
  ],
  'biblical_languages': [
    'hebrew', 'greek', 'aramaic', 'exegesis', 'original language', 'septuagint', 'manuscripts',
    'textual criticism', 'biblical languages', 'interlinear'
  ],
  'biblical_studies': [
    'bible', 'biblical', 'theology', 'scripture', 'exegesis', 'hermeneutics', 'context',
    'interpretation', 'testament', 'gospel', 'epistles', 'prophets', 'doctrine'
  ],
  'planning_quality': [
    'plan', 'planning', 'quality', 'qa', 'assurance', 'schedule', 'timeline', 'milestone',
    'testing', 'review', 'assessment', 'evaluation', 'checking', 'revision'
  ],
  'consulting_mentoring': [
    'mentor', 'mentoring', 'coaching', 'consulting', 'advisor', 'guide', 'teaching',
    'training', 'disciple', 'apprentice', 'servant-leader', 'feedback', 'development'
  ],
  'applied_technology': [
    'software development', 'app development', 'programming', 'coding', 'developer',
    'database', 'api', 'automation', 'workflow automation',
    'artificial intelligence', 'machine learning', 'chatgpt', 'gemini', 'openai',
    'llm', 'llms', 'large language model', 'prompt engineering',
    'ai tools', 'ai training', 'ai implementation', 'ai project',
    'tech training', 'digital literacy training', 'technology training',
    'inteligência artificial', 'ferramentas de ia', 'projeto de ia',
    'programação', 'desenvolvedor', 'desenvolvimento de software',
    'automação', 'banco de dados', 'treinamento em tecnologia', 'treinamento de ia',
    'digital technology', 'software', 'computer', 'tecnologia digital', 'computador'
  ],
  'reflective_practice': [
    'reflection', 'self-awareness', 'feedback', 'learning', 'growth', 'evaluation',
    'improvement', 'values', 'alignment', 'introspection', 'accountability', 'development'
  ]
};

/**
 * Detect which competencies are being discussed in a conversation
 * Returns an array of competency IDs ranked by relevance
 */
export function detectCompetenciesInConversation(text: string, limit: number = 3): string[] {
  const lowerText = text.toLowerCase();
  const competencyScores = new Map<string, number>();
  
  // Score each competency based on keyword matches
  for (const [competencyId, keywords] of Object.entries(CONVERSATION_COMPETENCY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > 0) {
      competencyScores.set(competencyId, score);
    }
  }
  
  // Sort by score and return top N
  return Array.from(competencyScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([competencyId]) => competencyId);
}
