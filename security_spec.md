# Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Site Configuration (`/site/{siteId}`)**:
   - Only document ID `'main'` is valid (`siteId == 'main'`).
   - Only a verified admin (`isAdmin()`) with `request.auth.token.email_verified == true` may create or update `/site/main`.
   - Every write must stamp `updatedBy == request.auth.uid` and `updatedAt == request.time`.
   - Deleting `/site/main` is strictly forbidden.
2. **Uploaded Media Metadata (`/media_assets/{assetId}`) & Chunks (`/media_assets/{assetId}/chunks/{chunkId}`)**:
   - Document IDs (`assetId`, `chunkId`) must match `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars).
   - Only verified admin (`isAdmin()`) may create or delete media assets and chunks.
   - `ownerId` must equal `request.auth.uid` on create and remain immutable.
   - Every `MediaChunk` requires an existing parent `/media_assets/{assetId}` whose `ownerId == request.auth.uid` (`Master Gate`).
   - Individual chunks are strictly capped at `<= 750000` characters (`< 1 MB` Firestore limit) and `size <= 20971520` (`20 MB`).
3. **Contact Messages (`/contact_messages/{messageId}`)**:
   - Contains visitor PII (`email`, `name`, `message`). Public `get` and `list` are strictly forbidden (`isAdmin()` only).
   - Public visitors may only `create` valid messages matching strict key allowlists (`hasAll`/`hasOnly`), length bounds, and `createdAt == request.time`.
4. **Admin Accounts (`/admins/{uid}`)**:
   - Self-assignment is strictly blocked (`isBootstrappedAdmin()` only for create/delete).
   - Individual user may read only their own `/admins/{uid}` status (`request.auth.uid == uid`). Blanket listing is disabled.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on `/site/main`**: Including extra field `"isAdmin": true` in site update payload -> denied by `keys().hasOnly(...)`.
2. **Unverified Email Admin Spoof**: Token has `email: "usat.jalung25@students.utdi.ac.id"` with `email_verified: false` -> denied by `email_verified == true`.
3. **Non-Admin Site Mutation**: Signed-in normal user attempts `setDoc` on `/site/main` -> denied by `isAdmin()`.
4. **Forged Timestamp on `/site/main`**: Setting `updatedAt` to a client `Timestamp` instead of `request.time` -> denied by `updatedAt == request.time`.
5. **Identity Spoofing on `/site/main`**: Admin tries to set `updatedBy` to another UID -> denied by `updatedBy == request.auth.uid`.
6. **ID Poisoning on `/media_assets/{assetId}`**: Writing with `assetId` containing spaces/slashes or `> 128` chars -> denied by `isValidId(assetId)`.
7. **Oversized Chunk Payload**: Writing `MediaChunk` with `data.size() > 750000` -> denied by size bound.
8. **Orphaned Media Chunk**: Writing `/media_assets/nonexistent/chunks/0` when parent asset doesn't exist -> denied by Master Gate `exists(...)`/`get(...)`.
9. **PII Leak on `/contact_messages`**: Unauthenticated or non-admin user calls `get` or `list` on `/contact_messages` -> denied by `isBootstrappedAdmin()` / `isAdmin()`.
10. **Contact Message Oversized Injection**: Submitting `message` with `> 2500` chars or missing `createdAt == request.time` -> denied by `isValidContactMessage()`.
11. **Self-Assigned Admin Escalation**: Non-bootstrapped user creates `/admins/{theirUid}` -> denied by `isBootstrappedAdmin()`.
12. **Site Document Deletion**: Attempting `deleteDoc` on `/site/main` even as admin -> denied by `allow delete: if false`.
