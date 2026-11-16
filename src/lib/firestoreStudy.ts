import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  ExamFocus,
  ExplanationDepth,
  FeatureMode,
  StudyLanguage,
  StudyMessage,
  StudySession,
  UserSettings,
} from '../types/study';

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function generateSafeId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomPart}`.slice(0, 128);
}

export function subscribeUserSettings(
  uid: string,
  onData: (settings: UserSettings | null) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid || uid),
        displayName: String(d.displayName || 'Student'),
        preferredLanguage: (d.preferredLanguage as StudyLanguage) || 'english',
        examFocus: (d.examFocus as ExamFocus) || 'general',
        explanationDepth: (d.explanationDepth as ExplanationDepth) || 'step-by-step',
        createdAtMs: toMillis(d.createdAt),
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserSettings(
  uid: string,
  settings: {
    displayName: string;
    preferredLanguage: StudyLanguage;
    examFocus: ExamFocus;
    explanationDepth: ExplanationDepth;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const safeName = settings.displayName.trim().slice(0, 100) || 'Student';

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid,
        displayName: safeName,
        preferredLanguage: settings.preferredLanguage,
        examFocus: settings.examFocus,
        explanationDepth: settings.explanationDepth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: safeName,
        preferredLanguage: settings.preferredLanguage,
        examFocus: settings.examFocus,
        explanationDepth: settings.explanationDepth,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeStudySessions(
  uid: string,
  onData: (sessions: StudySession[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/chats`;
  const q = query(collection(db, 'users', uid, 'chats'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: StudySession[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || uid),
          title: String(data.title || 'Untitled Study Session'),
          mode: (data.mode as FeatureMode) || 'chat',
          language: (data.language as StudyLanguage) || 'english',
          examFocus: (data.examFocus as ExamFocus) || 'general',
          lastMessagePreview: String(data.lastMessagePreview || ''),
          messageCount: Number(data.messageCount || 0),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeSessionMessages(
  uid: string,
  chatId: string,
  onData: (messages: StudyMessage[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/chats/${chatId}/messages`;
  const q = query(
    collection(db, 'users', uid, 'chats', chatId, 'messages'),
    where('userId', '==', uid),
    where('chatId', '==', chatId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: StudyMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          chatId: String(data.chatId || chatId),
          userId: String(data.userId || uid),
          role: data.role === 'assistant' ? 'assistant' : 'user',
          content: String(data.content || ''),
          language: (data.language as StudyLanguage) || 'english',
          hasAttachment: Boolean(data.hasAttachment),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      msgs.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(msgs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function persistStudyExchange(params: {
  uid: string;
  chatId: string;
  isNewSession: boolean;
  title: string;
  mode: FeatureMode;
  language: StudyLanguage;
  examFocus: ExamFocus;
  previousMessageCount: number;
  userText: string;
  assistantText: string;
  hasAttachment?: boolean;
}): Promise<void> {
  const {
    uid,
    chatId,
    isNewSession,
    title,
    mode,
    language,
    examFocus,
    previousMessageCount,
    userText,
    assistantText,
    hasAttachment = false,
  } = params;

  const chatPath = `users/${uid}/chats/${chatId}`;
  const chatRef = doc(db, 'users', uid, 'chats', chatId);
  const userMsgId = generateSafeId('msg_u');
  const assistantMsgId = generateSafeId('msg_a');
  const userMsgRef = doc(db, 'users', uid, 'chats', chatId, 'messages', userMsgId);
  const assistantMsgRef = doc(db, 'users', uid, 'chats', chatId, 'messages', assistantMsgId);

  const safeTitle = title.trim().slice(0, 160) || 'Study Session';
  const safeUserContent = userText.trim().slice(0, 32000) || '(Uploaded question)';
  const safeAssistantContent = assistantText.trim().slice(0, 32000) || '(No response)';
  const safePreview = safeAssistantContent.replace(/\s+/g, ' ').slice(0, 240);
  const nextCount = Math.min(1000, previousMessageCount + 2);

  try {
    const batch = writeBatch(db);

    if (isNewSession) {
      batch.set(chatRef, {
        id: chatId,
        userId: uid,
        title: safeTitle,
        mode,
        language,
        examFocus,
        lastMessagePreview: safePreview,
        messageCount: nextCount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(chatRef, {
        title: safeTitle,
        language,
        examFocus,
        lastMessagePreview: safePreview,
        messageCount: nextCount,
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(userMsgRef, {
      id: userMsgId,
      chatId,
      userId: uid,
      role: 'user',
      content: safeUserContent,
      language,
      hasAttachment,
      createdAt: serverTimestamp(),
    });

    batch.set(assistantMsgRef, {
      id: assistantMsgId,
      chatId,
      userId: uid,
      role: 'assistant',
      content: safeAssistantContent,
      language,
      hasAttachment: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, chatPath);
  }
}

export async function deleteStudySession(uid: string, chatId: string): Promise<void> {
  const chatPath = `users/${uid}/chats/${chatId}`;
  try {
    const msgsQuery = query(
      collection(db, 'users', uid, 'chats', chatId, 'messages'),
      where('userId', '==', uid),
      where('chatId', '==', chatId)
    );
    const msgsSnap = await getDocs(msgsQuery);
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    batch.delete(doc(db, 'users', uid, 'chats', chatId));
    await batch.commit();
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'users', uid, 'chats', chatId));
    } catch {
      handleFirestoreError(error, OperationType.DELETE, chatPath);
    }
  }
}
