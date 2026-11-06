/**
 * Domain model and backend contract.
 *
 * Every piece of UI talks to a `Backend` implementation. `LocalBackend` powers
 * the persistent demo mode (and offline cache) entirely on-device.
 * `RemoteBackend` is the integration boundary for a real server (see
 * docs/BACKEND.md) and is not configured in this build.
 */

export type ID = string;
export type ISODate = string; // full ISO timestamp
export type DayKey = string; // "YYYY-MM-DD" in the couple timezone

export type RelationshipStage = 'dating' | 'committed' | 'engaged' | 'married' | 'other';
export type Goal = 'deeper_conversations' | 'daily_connection' | 'playful_moments' | 'planning_visits';

export interface Profile {
  id: ID;
  firstName: string;
  avatarUri: string | null;
  pronouns: string | null;
  timezone: string;
  email: string | null;
  isSimulated?: boolean;
}

export interface Couple {
  id: ID;
  memberIds: ID[]; // max 2
  relationshipStage: RelationshipStage | null;
  relationshipStart: string | null; // "YYYY-MM-DD"
  distanceMode: 'long_distance' | 'nearby' | null;
  goals: Goal[];
  coupleTimezone: string; // explicit day boundary
  createdAt: ISODate;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface Invitation {
  id: ID;
  code: string;
  token: string;
  inviterId: ID;
  inviterName: string;
  status: InvitationStatus;
  createdAt: ISODate;
  expiresAt: ISODate;
  acceptedBy: ID | null;
}

export interface SharingPermission {
  userId: ID;
  location: boolean;
  battery: boolean;
  updatedAt: ISODate;
}

export interface LiveInfo {
  userId: ID;
  lat: number | null;
  lon: number | null;
  city: string | null;
  country: string | null;
  accuracyMeters: number | null;
  locationUpdatedAt: ISODate | null;
  batteryPercent: number | null;
  batteryUpdatedAt: ISODate | null;
}

export type MediaKind = 'photo' | 'video' | 'voice';
export interface MediaAsset {
  id: ID;
  kind: MediaKind;
  uri: string;
  width?: number;
  height?: number;
  durationMs?: number;
  sizeBytes?: number;
  uploadState: 'pending' | 'uploading' | 'uploaded' | 'failed';
  createdAt: ISODate;
}

export interface Moment {
  id: ID;
  coupleId: ID;
  authorId: ID;
  dayKey: DayKey;
  media: MediaAsset;
  caption: string | null;
  createdAt: ISODate;
  clientRequestId: string; // idempotency key
}

export interface StreakCompletion {
  dayKey: DayKey;
  completedAt: ISODate;
}

export interface StreakState {
  current: number;
  longest: number;
  startedOn: DayKey | null;
  lastCompletedDay: DayKey | null;
  completions: StreakCompletion[];
}

export type ActivityType = 'daily_question' | 'quiz' | 'would_you_rather' | 'guess' | 'photo_challenge' | 'deck';
export type DeckCategory =
  | 'getting_to_know'
  | 'everyday'
  | 'deeper'
  | 'love'
  | 'long_distance'
  | 'future'
  | 'repair'
  | 'fun';

export interface Question {
  id: ID;
  type: ActivityType;
  category: DeckCategory;
  text: string;
  options?: string[]; // multiple choice
  aboutPartner?: boolean; // for guess/quiz
}

export interface Deck {
  id: ID;
  title: string;
  category: DeckCategory;
  description: string;
  type: ActivityType;
  questionIds: ID[];
  premium: boolean;
  emoji: string;
}

export type SessionStatus = 'in_progress' | 'waiting' | 'revealed' | 'abandoned';
export interface Submission {
  userId: ID;
  answer: string;
  comment: string | null;
  skipped: boolean;
  submittedAt: ISODate;
}
export interface ActivitySession {
  id: ID;
  coupleId: ID;
  deckId: ID;
  questionId: ID;
  status: SessionStatus;
  createdAt: ISODate;
  revealedAt: ISODate | null;
  /** Only the viewer's own submission is returned until reveal. */
  submissions: Submission[];
  reactions: Record<ID, string>; // userId -> emoji
  drafts?: Record<ID, string>;
}

export type AffectionKind = 'kiss' | 'hug' | 'thinking' | 'need_you';
export type MessageKind = 'affection' | 'text' | 'voice';
export interface Message {
  id: ID;
  coupleId: ID;
  senderId: ID;
  kind: MessageKind;
  affection?: AffectionKind;
  text: string | null;
  media: MediaAsset | null;
  context?: string | null;
  createdAt: ISODate;
  delivery: 'queued' | 'sent' | 'failed';
  readAt: ISODate | null;
  reactions: Record<ID, string>;
  clientRequestId: string;
}

export type MemoryKind = 'moment' | 'photo' | 'video' | 'voice' | 'letter';
export interface Memory {
  id: ID;
  coupleId: ID;
  ownerId: ID;
  kind: MemoryKind;
  media: MediaAsset | null;
  title: string | null;
  body: string | null; // letters
  caption: string | null;
  takenOn: DayKey;
  createdAt: ISODate;
  favoritedBy: ID[];
  momentId?: ID;
}

export type EventKind = 'meeting' | 'anniversary' | 'birthday' | 'visit' | 'custom';
export interface CalendarEvent {
  id: ID;
  coupleId: ID;
  kind: EventKind;
  title: string;
  date: string; // "YYYY-MM-DD"
  allDay: boolean;
  time: string | null; // "HH:mm"
  timezone: string;
  destination: string | null;
  notes: string | null;
  recurringAnnual: boolean;
  reminders: number[]; // days before
  cancelled: boolean;
  createdBy: ID;
}

export interface WidgetMessage {
  text: string;
  authorId: ID;
  updatedAt: ISODate;
}

export interface Entitlements {
  premium: boolean;
  source: 'none' | 'demo' | 'store';
}

export interface AuthSession {
  userId: ID;
  email: string;
  verified: boolean;
  demo: boolean;
}

export class BackendError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
