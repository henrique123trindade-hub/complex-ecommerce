import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupBrazilianCep } from './cepLookup';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('lookupBrazilianCep uses local /api/cep when available and complete', async () => {
  const result = await lookupBrazilianCep('01310-100', async (url) => {
    assert.equal(url, '/api/cep/01310100');
    return jsonResponse({
      cep: '01310-100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      source: 'viacep',
    });
  });

  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.data.street, 'Avenida Paulista');
    assert.equal(result.data.neighborhood, 'Bela Vista');
    assert.equal(result.data.city, 'São Paulo');
    assert.equal(result.data.state, 'SP');
  }
});

test('lookupBrazilianCep falls back to ViaCEP when /api/cep returns 404 (Vercel/static deployment)', async () => {
  const calls: string[] = [];
  const result = await lookupBrazilianCep('01310100', async (url) => {
    calls.push(url);
    if (url.startsWith('/api/cep/')) {
      return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    return jsonResponse({
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });
  });

  assert.equal(calls.length, 2);
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.data.source, 'viacep');
    assert.equal(result.data.street, 'Avenida Paulista');
    assert.equal(result.data.city, 'São Paulo');
    assert.equal(result.data.state, 'SP');
  }
});

test('lookupBrazilianCep falls back to BrasilAPI when /api/cep and ViaCEP fail', async () => {
  const result = await lookupBrazilianCep('22041-001', async (url) => {
    if (url.startsWith('/api/cep/') || url.includes('viacep')) {
      return new Response('Service Unavailable', { status: 503 });
    }
    return jsonResponse({
      cep: '22041001',
      street: 'Avenida Atlântica',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
    });
  });

  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.data.source, 'brasilapi');
    assert.equal(result.data.street, 'Avenida Atlântica');
    assert.equal(result.data.state, 'RJ');
  }
});

test('lookupBrazilianCep returns not_found when ViaCEP reports erro: true', async () => {
  const result = await lookupBrazilianCep('99999-999', async (url) => {
    if (url.startsWith('/api/cep/')) {
      return new Response('Not Found', { status: 404 });
    }
    return jsonResponse({ erro: true });
  });

  assert.equal(result.status, 'not_found');
});
