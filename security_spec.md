# Security Specification — Scorer's Study AI

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document under `/users/{userId}`, `/users/{userId}/chats/{chatId}`, and `/users/{userId}/chats/{chatId}/messages/{messageId}` is owned solely by `userId`. No other authenticated or unauthenticated user can read, list, create, update, or delete another user's records.
2. **Verified Identity**: All writes and private reads require `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
3. **Immutable Ownership & Creation Timestamps**: `uid`, `userId`, `id`, `chatId`, and `createdAt` can never be reassigned after creation.
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time` (server timestamp).
5. **Relational & Atomic Integrity**: A `StudyMessage` cannot exist without its parent `StudySession` (`existsAfter(...)` on the parent chat document), and `message.chatId` must match the `{chatId}` path segment.
6. **Bounded Payloads**: All IDs match `^[a-zA-Z0-9_\-]+$` and $\le 128$ chars; titles $\le 160$ chars; previews $\le 240$ chars; message content $\le 32000$ chars. No shadow/unlisted keys are permitted (`keys().hasAll(...)` and `keys().hasOnly(...)`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-User Read (`GET /users/victimUid/chats/c1`)** as `attackerUid` -> `PERMISSION_DENIED`.
2. **Collection Enumeration (`LIST /users`)** as any authenticated user -> `PERMISSION_DENIED`.
3. **Unverified Email Write (`CREATE /users/u1/chats/c1`)** with `email_verified: false` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create (`CREATE /users/attackerUid/chats/c1`)** with `userId: "victimUid"` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection (`CREATE /users/u1/chats/c1`)** with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Forged Timestamp (`CREATE /users/u1/chats/c1`)** with client-provided past `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
7. **ID Poisoning (`CREATE /users/u1/chats/bad$id..slash`)** -> `PERMISSION_DENIED` by `isValidId(chatId)`.
8. **Content Exhaustion (`CREATE /users/u1/chats/c1/messages/m1`)** with 50,000-char `content` -> `PERMISSION_DENIED`.
9. **Invalid Enum Value (`UPDATE /users/u1`)** with `preferredLanguage: "klingon"` -> `PERMISSION_DENIED`.
10. **Immutable Field Tampering (`UPDATE /users/u1/chats/c1`)** changing `createdAt` or `userId` -> `PERMISSION_DENIED`.
11. **Orphaned Message (`CREATE /users/u1/chats/nonexistent/messages/m1`)** without parent chat -> `PERMISSION_DENIED` by `existsAfter(...)`.
12. **Path-Body Mismatch (`CREATE /users/u1/chats/c1/messages/m1`)** with `chatId: "c2"` -> `PERMISSION_DENIED`.
