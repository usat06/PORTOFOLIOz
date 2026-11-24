import assert from 'node:assert/strict';

export interface DirtyPayloadCase {
  name: string;
  path: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyPayloadCase[] = [
  {
    name: '1. Shadow field injection on /site/main',
    path: '/site/main',
    operation: 'update',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { brandName: 'Test', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Email spoofing with email_verified = false',
    path: '/site/main',
    operation: 'update',
    auth: { uid: 'attacker', email: 'usat.jalung25@students.utdi.ac.id', email_verified: false },
    payload: { brandName: 'Hacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Non-admin site mutation',
    path: '/site/main',
    operation: 'update',
    auth: { uid: 'user-2', email: 'visitor@example.com', email_verified: true },
    payload: { brandName: 'Visitor' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Client-forged updatedAt timestamp on /site/main',
    path: '/site/main',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { updatedAt: '2020-01-01T00:00:00Z', updatedBy: 'admin-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Identity spoofing updatedBy != request.auth.uid',
    path: '/site/main',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { updatedBy: 'other-uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Document ID poisoning on /media_assets',
    path: `/media_assets/${'x'.repeat(140)}`,
    operation: 'create',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { id: 'bad', ownerId: 'admin-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Oversized media chunk payload (> 750000 chars)',
    path: '/media_assets/asset_1/chunks/0',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { assetId: 'asset_1', index: 0, dataLength: 800000, ownerId: 'admin-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Orphaned media chunk without parent MediaAsset',
    path: '/media_assets/missing_parent/chunks/0',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    payload: { assetId: 'missing_parent', index: 0, data: 'AAAA', ownerId: 'admin-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. PII leak attempt reading /contact_messages as non-admin',
    path: '/contact_messages',
    operation: 'list',
    auth: { uid: 'user-2', email: 'visitor@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Contact message oversized injection',
    path: '/contact_messages/msg_1',
    operation: 'create',
    auth: null,
    payload: { id: 'msg_1', name: 'A', email: 'a@b.com', subject: 'Hi', messageLength: 5000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Self-assigned admin escalation on /admins/{uid}',
    path: '/admins/user-2',
    operation: 'create',
    auth: { uid: 'user-2', email: 'visitor@example.com', email_verified: true },
    payload: { uid: 'user-2', email: 'visitor@example.com' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Deleting /site/main document',
    path: '/site/main',
    operation: 'delete',
    auth: { uid: 'admin-1', email: 'usat.jalung25@students.utdi.ac.id', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];

assert.equal(DIRTY_DOZEN_CASES.length, 12);
