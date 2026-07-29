/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Medication {
  id: string;
  nameKey: string;
  dosage: string;
  frequencyKey: string;
  durationDays: number;
  startDate: string;
  pillsTaken: (boolean | number)[]; // Representing adherence per day
  typeKey: string;
  scientificContextKey?: string;
  remainingPills: number;
  totalPills: number;
  scheduledTimes?: string[]; // Array of times like ["08:00", "14:00"]
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface QuizQuestion {
  question: { uz: string; ru: string; en: string; 'uz-cyrl': string };
  options: { uz: string; ru: string; en: string; 'uz-cyrl': string }[]; // 4 options
  correctOptionIndex: number;
}

export interface UserStats {
  streak: number;
  xp: number;
  hCoins: number;
  level: number;
  adherenceRate: number;
  fullName?: string;
  birthDate?: string;
  completedQuizzes?: string[]; // IDs of news articles whose quizzes were completed
}

export interface HealthTip {
  id: string;
  category: 'nutrition' | 'activity' | 'mental';
  content: string;
  icon: string;
}

export interface AdherenceData {
  day: string;
  adherence: number; // 0 to 1
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface NewsPost {
  id: string;
  title: { uz: string; ru: string; en: string; 'uz-cyrl': string };
  content: { uz: string; ru: string; en: string; 'uz-cyrl': string };
  imageUrl: string;
  category: string;
  createdAt: number;
  quiz?: QuizQuestion[];
}

export interface Gift {
  id: string;
  lat: number;
  lng: number;
  collected: boolean;
  reward: number;
}

export interface DailyTask {
  id: string;
  type: 'walk';
  targetDistance: number; // in meters
  currentDistance: number;
  completed: boolean;
  gifts: Gift[];
}

export interface VideoQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  userAnswer?: number;
}

export interface VideoLesson {
  id: string;
  title: string;
  iframeCode: string;
  description: string;
  quiz: VideoQuizQuestion[];
  completed: boolean;
}
