import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('GET /api/v1/health répond 200 et annonce le service', async (t) => {
  const app = buildApp({ logger: false });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, '5sync-api');
});

test("une route inconnue répond 404 en JSON, pas en HTML", async (t) => {
  const app = buildApp({ logger: false });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/inexistant' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, 'not_found');
});
