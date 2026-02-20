export interface CompetencyImpact {
  competencyId: string;
  weight: number;
}

export interface ActivityType {
  type: string;
  impacts: CompetencyImpact[];
  yearsMultiplier?: number;
}

export interface QualificationPattern {
  keywords: string[];
  impacts: CompetencyImpact[];
}

export const QUALIFICATION_PATTERNS: QualificationPattern[] = [
  {
    keywords: ['leadership', 'team building', 'conflict resolution', 'active listening', 'group dynamics', 'team leadership'],
    impacts: [
      { competencyId: 'interpersonal_skills', weight: 5 },
    ]
  },
  
  {
    keywords: ['cross-cultural', 'intercultural', 'cultural sensitivity', 'anthropology', 'ethnography', 'cultural adaptation'],
    impacts: [
      { competencyId: 'intercultural_communication', weight: 5 },
    ]
  },
  
  {
    keywords: ['oral bible translation', 'obt training', 'storytelling methods', 'multimodal', 'embodied learning', 'oral communication methods'],
    impacts: [
      { competencyId: 'multimodal_skills', weight: 5 },
    ]
  },
  
  {
    keywords: ['translation theory', 'translation principles', 'translation methods', 'bible translation', 'translation studies'],
    impacts: [
      { competencyId: 'translation_theory', weight: 5 },
    ]
  },
  
  {
    keywords: ['linguistics', 'applied linguistics', 'semantics', 'pragmatics', 'discourse analysis', 'language structure', 'phonetics', 'phonology', 'morphology', 'syntax'],
    impacts: [
      { competencyId: 'languages_communication', weight: 5 },
    ]
  },
  
  {
    keywords: ['biblical hebrew', 'biblical greek', 'koine greek', 'aramaic', 'original languages', 'hebrew exegesis', 'greek exegesis'],
    impacts: [
      { competencyId: 'biblical_languages', weight: 5 },
    ]
  },
  
  {
    keywords: ['theology', 'theological studies', 'biblical studies', 'hermeneutics', 'biblical interpretation', 'biblical theology', 'systematic theology'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 5 },
    ]
  },
  
  {
    keywords: ['project management', 'quality assurance', 'qa training', 'quality control', 'project planning', 'translation consultant'],
    impacts: [
      { competencyId: 'planning_quality', weight: 5 },
    ]
  },
  
  {
    keywords: ['mentoring', 'mentorship training', 'coaching', 'consulting', 'translation consultant', 'mentor training', 'discipleship training'],
    impacts: [
      { competencyId: 'consulting_mentoring', weight: 5 },
    ]
  },
  
  {
    keywords: ['audio technology', 'recording technology', 'digital tools', 'software training', 'technology for translation', 'digital literacy', 'computer science'],
    impacts: [
      { competencyId: 'applied_technology', weight: 5 },
    ]
  },
  
  {
    keywords: ['reflective practice', 'self-awareness training', 'emotional intelligence', 'personal development', 'leadership development'],
    impacts: [
      { competencyId: 'reflective_practice', weight: 5 },
    ]
  },
  
  {
    keywords: ['dts', 'discipleship training school'],
    impacts: [
      { competencyId: 'biblical_studies', weight: 3 },
      { competencyId: 'intercultural_communication', weight: 2 },
    ]
  },
];

export const ACTIVITY_TYPE_IMPACTS: Record<string, CompetencyImpact[]> = {
  'translation': [
    { competencyId: 'translation_theory', weight: 4 },
    { competencyId: 'multimodal_skills', weight: 3 },
  ],
  'facilitation': [
    { competencyId: 'interpersonal_skills', weight: 4 },
    { competencyId: 'consulting_mentoring', weight: 4 },
    { competencyId: 'reflective_practice', weight: 3 },
  ],
  'teaching': [
    { competencyId: 'consulting_mentoring', weight: 4 },
    { competencyId: 'interpersonal_skills', weight: 3 },
  ],
  'biblical_teaching': [
    { competencyId: 'biblical_studies', weight: 5 },
    { competencyId: 'consulting_mentoring', weight: 3 },
    { competencyId: 'interpersonal_skills', weight: 2 },
  ],
  'long_term_mentoring': [
    { competencyId: 'consulting_mentoring', weight: 5 },
    { competencyId: 'reflective_practice', weight: 4 },
    { competencyId: 'interpersonal_skills', weight: 3 },
  ],
  'oral_facilitation': [
    { competencyId: 'multimodal_skills', weight: 5 },
    { competencyId: 'consulting_mentoring', weight: 4 },
    { competencyId: 'interpersonal_skills', weight: 3 },
  ],
  'quality_assurance_work': [
    { competencyId: 'planning_quality', weight: 5 },
    { competencyId: 'translation_theory', weight: 3 },
  ],
  'community_engagement': [
    { competencyId: 'intercultural_communication', weight: 5 },
    { competencyId: 'interpersonal_skills', weight: 3 },
  ],
  'indigenous_work': [
    { competencyId: 'intercultural_communication', weight: 5 },
    { competencyId: 'multimodal_skills', weight: 3 },
  ],
  'school_work': [
    { competencyId: 'interpersonal_skills', weight: 3 },
  ],
  'general_experience': [
    { competencyId: 'reflective_practice', weight: 2 },
  ],
};

export function getCourseLevelMultiplier(courseLevel?: string | null): number {
  switch (courseLevel) {
    case 'introduction': return 0.5;
    case 'certificate': return 1.2;
    case 'bachelor': return 3.0;
    case 'master': return 4.4;
    case 'doctoral': return 5.0;
    default: return 1.2;
  }
}

export function calculateQualificationImpacts(
  courseTitle: string,
  description?: string | null,
  courseLevel?: string | null
): Map<string, number> {
  const impacts = new Map<string, number>();
  const searchText = `${courseTitle} ${description || ''}`.toLowerCase();
  const levelMultiplier = getCourseLevelMultiplier(courseLevel);
  
  for (const pattern of QUALIFICATION_PATTERNS) {
    const matches = pattern.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (matches) {
      for (const impact of pattern.impacts) {
        const currentWeight = impacts.get(impact.competencyId) || 0;
        impacts.set(impact.competencyId, currentWeight + (impact.weight * levelMultiplier));
      }
    }
  }
  
  return impacts;
}

export function scoreToStatus(score: number): string {
  if (score === 0) return 'not_started';
  if (score <= 5) return 'emerging';
  if (score <= 12) return 'growing';
  if (score <= 20) return 'proficient';
  return 'advanced';
}

export function statusToMinScore(status: string): number {
  switch (status) {
    case 'not_started':
      return 0;
    case 'emerging':
      return 1;
    case 'growing':
      return 6;
    case 'proficient':
      return 13;
    case 'advanced':
      return 21;
    default:
      return 0;
  }
}

export function calculateActivityImpacts(
  activityType: string | null,
  yearsOfExperience?: number | null,
  description?: string | null,
  chaptersCount?: number | null,
  durationYears?: number | null,
  durationMonths?: number | null
): Map<string, number> {
  const impacts = new Map<string, number>();
  
  const type = activityType || 'general_experience';
  
  const baseImpacts = ACTIVITY_TYPE_IMPACTS[type] || ACTIVITY_TYPE_IMPACTS['general_experience'];
  
  let multiplier = 1;
  
  let totalYears = 0;
  if (durationYears !== null && durationYears !== undefined) {
    totalYears = durationYears + ((durationMonths || 0) / 12);
  } else if (yearsOfExperience && yearsOfExperience > 0) {
    totalYears = yearsOfExperience;
  }
  
  if (totalYears > 0) {
    multiplier = Math.min(1 + (totalYears - 1) * 0.3, 4.0);
  }
  
  for (const impact of baseImpacts) {
    impacts.set(impact.competencyId, impact.weight * multiplier);
  }
  
  if (type === 'translation' && chaptersCount && chaptersCount > 0) {
    const current = impacts.get('translation_theory') || 0;
    let chapterBonus = 0;
    
    if (chaptersCount >= 60) chapterBonus = 2;
    else if (chaptersCount >= 31) chapterBonus = 1.5;
    else if (chaptersCount >= 11) chapterBonus = 1;
    else chapterBonus = 0.5;
    
    impacts.set('translation_theory', current + chapterBonus);
  }
  
  return impacts;
}

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
  
  for (const qualification of qualifications) {
    const impacts = calculateQualificationImpacts(
      qualification.courseTitle,
      qualification.description,
      qualification.courseLevel
    );
    
    const impactEntries = Array.from(impacts.entries());
    for (const [competencyId, weight] of impactEntries) {
      const currentScore = educationScores.get(competencyId) || 0;
      educationScores.set(competencyId, currentScore + weight);
    }
  }
  
  if (activities) {
    for (const activity of activities) {
      const impacts = calculateActivityImpacts(
        activity.activityType ?? null,
        activity.yearsOfExperience ?? null,
        activity.description ?? null,
        activity.chaptersCount ?? null,
        activity.durationYears ?? null,
        activity.durationMonths ?? null
      );
      
      const impactEntries = Array.from(impacts.entries());
      for (const [competencyId, weight] of impactEntries) {
        const currentScore = experienceScores.get(competencyId) || 0;
        experienceScores.set(competencyId, currentScore + weight);
      }
    }
  }
  
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

export function detectCompetenciesInConversation(text: string, limit: number = 3): string[] {
  const lowerText = text.toLowerCase();
  const competencyScores = new Map<string, number>();
  
  for (const [competencyId, keywords] of Object.entries(CONVERSATION_COMPETENCY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
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
  
  return Array.from(competencyScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([competencyId]) => competencyId);
}
