import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Firebase server modules load without CommonJS-to-ESM support', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', "require('firebase-admin/app'); require('firebase-admin/auth'); require('firebase-admin/firestore');"], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});
