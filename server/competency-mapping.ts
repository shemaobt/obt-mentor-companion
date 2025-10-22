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
 * When a qualification matches multiple patterns, weights are summed
 */
export const QUALIFICATION_PATTERNS: QualificationPattern[] = [
  // Interpersonal & Team Leadership Skills
  {
    keywords: ['leadership', 'team building', 'conflict resolution', 'active listening', 'empathy', 'facilitation', 'group dynamics'],
    impacts: [
      { competencyId: 'interpersonal_skills', weight: 5 },
      { competencyId: 'consulting_mentoring', weight: 3 },
    ]
  },
  
  // Cross-cultural & Intercultural Communication
  {
    keywords: ['cross-cultural', 'intercultural', 'cultural sensitivity', 'anthropology', 'ethnography', 'cultural adaptation'],
    impacts: [
      { competencyId: 'intercultural_communication', weight: 5 },
      { competencyId: 'interpersonal_skills', weight: 2 },
    ]
  },
  
  // Oral Communication & Multimodal Methods
  {
    keywords: ['oral', 'obt', 'oral bible translation', 'storytelling', 'narrative', 'multimodal', 'embodied learning', 'gestures', 'visual communication'],
    impacts: [
      { competencyId: 'multimodal_skills', weight: 5 },
      { competencyId: 'translation_theory', weight: 3 },
    ]
  },
  
  // Translation Theory & Linguistics
  {
    keywords: ['translation', 'linguistics', 'translation theory', 'phonetics', 'phonology', 'morphology', 'syntax', 'semantics', 'discourse analysis'],
    impacts: [
      { competencyId: 'translation_theory', weight: 5 },
      { competencyId: 'languages_communication', weight: 4 },
    ]
  },
  
  // Languages & Communication (Semantics, Pragmatics, Metaphor)
  {
    keywords: ['semantics', 'pragmatics', 'metaphor', 'discourse', 'communication theory', 'linguistic analysis', 'language structure'],
    impacts: [
      { competencyId: 'languages_communication', weight: 5 },
      { competencyId: 'translation_theory', weight: 3 },
    ]
  },
  
  // Biblical Languages (Hebrew, Greek, Aramaic)
  {
    keywords: ['hebrew', 'greek', 'aramaic', 'biblical language', 'exegesis', 'original languages'],
    impacts: [
      { competencyId: 'biblical_languages', weight: 5 },
      { competencyId: 'biblical_studies', weight: 3 },
    ]
  },
  
  // Biblical Studies & Theology
  {
    keywords: ['bible', 'biblical', 'theology', 'theological', 'scripture', 'hermeneutics', 'biblical interpretation'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 5 },
      { competencyId: 'biblical_languages', weight: 2 },
    ]
  },
  
  // Planning & Quality Assurance
  {
    keywords: ['project management', 'planning', 'quality assurance', 'qa', 'quality control', 'project planning', 'scheduling', 'budgeting'],
    impacts: [
      { competencyId: 'planning_quality', weight: 5 },
      { competencyId: 'consulting_mentoring', weight: 2 },
    ]
  },
  
  // Consulting & Mentoring
  {
    keywords: ['mentor', 'mentoring', 'mentorship', 'coaching', 'consulting', 'training', 'teaching', 'discipleship', 'servant leadership'],
    impacts: [
      { competencyId: 'consulting_mentoring', weight: 5 },
      { competencyId: 'interpersonal_skills', weight: 3 },
    ]
  },
  
  // Applied Technology
  {
    keywords: ['technology', 'audio recording', 'editing', 'digital tools', 'software', 'ai', 'artificial intelligence', 'remote collaboration', 'digital literacy'],
    impacts: [
      { competencyId: 'applied_technology', weight: 5 },
      { competencyId: 'multimodal_skills', weight: 2 },
    ]
  },
  
  // Reflective Practice & Self-awareness
  {
    keywords: ['reflective practice', 'self-awareness', 'emotional intelligence', 'self-regulation', 'personal growth', 'feedback', 'introspection'],
    impacts: [
      { competencyId: 'reflective_practice', weight: 5 },
      { competencyId: 'interpersonal_skills', weight: 3 },
    ]
  },
  
  // YWAM Specific Courses
  {
    keywords: ['dts', 'discipleship training school', 'ywam', 'youth with a mission'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 4 },
      { competencyId: 'intercultural_communication', weight: 3 },
      { competencyId: 'consulting_mentoring', weight: 3 },
    ]
  },
];

/**
 * Activity type mappings to competencies
 * Maps different work experience types to relevant competencies
 */
export const ACTIVITY_TYPE_IMPACTS: Record<string, CompetencyImpact[]> = {
  'translation': [
    { competencyId: 'translation_theory', weight: 3 },
    { competencyId: 'languages_communication', weight: 3 },
    { competencyId: 'multimodal_skills', weight: 2 },
    { competencyId: 'consulting_mentoring', weight: 2 },
    { competencyId: 'planning_quality', weight: 1 },
  ],
  'facilitation': [
    { competencyId: 'interpersonal_skills', weight: 4 },
    { competencyId: 'consulting_mentoring', weight: 4 },
    { competencyId: 'planning_quality', weight: 3 },
    { competencyId: 'intercultural_communication', weight: 2 },
    { competencyId: 'reflective_practice', weight: 2 },
  ],
  'teaching': [
    { competencyId: 'consulting_mentoring', weight: 4 },
    { competencyId: 'interpersonal_skills', weight: 3 },
    { competencyId: 'planning_quality', weight: 2 },
    { competencyId: 'reflective_practice', weight: 2 },
  ],
  'indigenous_work': [
    { competencyId: 'intercultural_communication', weight: 5 },
    { competencyId: 'interpersonal_skills', weight: 3 },
    { competencyId: 'languages_communication', weight: 2 },
    { competencyId: 'reflective_practice', weight: 2 },
  ],
  'school_work': [
    { competencyId: 'interpersonal_skills', weight: 2 },
    { competencyId: 'planning_quality', weight: 2 },
    { competencyId: 'reflective_practice', weight: 1 },
  ],
  'general_experience': [
    { competencyId: 'interpersonal_skills', weight: 1 },
    { competencyId: 'reflective_practice', weight: 1 },
  ],
};

/**
 * Get multiplier based on course level
 * - introduction: 0.8x (basic awareness)
 * - certificate: 1.0x (baseline competency)
 * - bachelor: 1.2x (strong foundation)
 * - master: 1.5x (advanced expertise)
 * - doctoral: 1.8x (expert level)
 */
export function getCourseLevelMultiplier(courseLevel?: string | null): number {
  switch (courseLevel) {
    case 'introduction': return 0.8;
    case 'certificate': return 1.0;
    case 'bachelor': return 1.2;
    case 'master': return 1.5;
    case 'doctoral': return 1.8;
    default: return 1.0; // Default to certificate level if not specified
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
  chaptersCount?: number | null
): Map<string, number> {
  const impacts = new Map<string, number>();
  
  // Default to general_experience for activities without explicit type
  // This avoids mis-scoring and is safer than inferring type from other fields
  // Legacy translation activities should be re-added with explicit activityType
  const type = activityType || 'general_experience';
  
  // Get base impacts for this activity type
  const baseImpacts = ACTIVITY_TYPE_IMPACTS[type] || ACTIVITY_TYPE_IMPACTS['general_experience'];
  
  // Calculate multiplier based on years of experience
  let multiplier = 1;
  if (yearsOfExperience && yearsOfExperience > 0) {
    // Scale: 1 year = 1.0x, 2 years = 1.2x, 3 years = 1.4x, 5+ years = 2.0x
    multiplier = Math.min(1 + (yearsOfExperience - 1) * 0.2, 2.0);
  } else if (chaptersCount && chaptersCount > 0) {
    // For translation activities, use chapters as a proxy for experience
    // Scale: 1-5 chapters = 1.0x, 6-10 = 1.2x, 11-20 = 1.5x, 20+ = 2.0x
    if (chaptersCount >= 20) multiplier = 2.0;
    else if (chaptersCount >= 11) multiplier = 1.5;
    else if (chaptersCount >= 6) multiplier = 1.2;
  }
  
  // Apply base impacts with multiplier
  for (const impact of baseImpacts) {
    impacts.set(impact.competencyId, impact.weight * multiplier);
  }
  
  // Additional keyword-based impacts from description
  if (description) {
    const descLower = description.toLowerCase();
    
    // Check for additional skill indicators in description
    const keywordBoosts: Array<{ keywords: string[]; competencyId: string; boost: number }> = [
      { keywords: ['lead', 'leader', 'leadership'], competencyId: 'interpersonal_skills', boost: 1 },
      { keywords: ['mentor', 'coach', 'train'], competencyId: 'consulting_mentoring', boost: 1 },
      { keywords: ['translation', 'translate'], competencyId: 'translation_theory', boost: 1 },
      { keywords: ['culture', 'cultural', 'cross-cultural'], competencyId: 'intercultural_communication', boost: 1 },
      { keywords: ['technology', 'software', 'digital'], competencyId: 'applied_technology', boost: 1 },
    ];
    
    for (const { keywords, competencyId, boost } of keywordBoosts) {
      if (keywords.some(kw => descLower.includes(kw))) {
        const current = impacts.get(competencyId) || 0;
        impacts.set(competencyId, current + boost);
      }
    }
  }
  
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
        activity.chaptersCount || null
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
    'technology', 'tech', 'software', 'tool', 'app', 'recording', 'digital', 'online',
    'computer', 'mobile', 'platform', 'audio', 'video', 'collaboration tools'
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
