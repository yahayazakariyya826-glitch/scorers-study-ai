export type StudyLanguage = 'english' | 'hausa' | 'bilingual';

export type ExamFocus = 'general' | 'jamb' | 'waec' | 'university' | 'coding';

export type ExplanationDepth = 'concise' | 'step-by-step';

export type FeatureMode = 'chat' | 'vision' | 'prompt';

export type ActiveView = 'chat' | 'vision' | 'prompt' | 'settings';

export interface UserSettings {
  uid: string;
  displayName: string;
  preferredLanguage: StudyLanguage;
  examFocus: ExamFocus;
  explanationDepth: ExplanationDepth;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface StudySession {
  id: string;
  userId: string;
  title: string;
  mode: FeatureMode;
  language: StudyLanguage;
  examFocus: ExamFocus;
  lastMessagePreview: string;
  messageCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface StudyMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  language: StudyLanguage;
  hasAttachment: boolean;
  createdAtMs: number;
}
