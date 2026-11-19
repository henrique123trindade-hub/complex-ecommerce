import { formatCep, normalizeDigits } from './commerce';

export interface CepAddressData {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  source: 'api' | 'viacep' | 'brasilapi';
}

export type CepLookupResult =
  | { status: 'found'; data: CepAddressData }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function fetchJsonWithTimeout(
  url: string,
  fetchImpl: FetchLike,
  timeoutMs = 4500
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: res.status, data: null };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a Brazilian 8-digit CEP with multi-provider resilience:
 * 1. Tries local /api/cep/:cep when running behind Express.
 * 2. Falls back directly to ViaCEP (CORS-enabled) for static/Vercel deployments.
 * 3. Falls back to BrasilAPI (CORS-enabled) if ViaCEP is unreachable.
 */
export async function lookupBrazilianCep(
  rawCep: string,
  fetchImpl: FetchLike = fetch
): Promise<CepLookupResult> {
  const digits = normalizeDigits(rawCep);
  if (digits.length !== 8) {
    return { status: 'error', message: 'Informe um CEP com 8 dígitos.' };
  }
  const formattedCep = formatCep(digits);

  // 1. Try local Express endpoint first (fast & cached if backend is active)
  const local = await fetchJsonWithTimeout(`/api/cep/${digits}`, fetchImpl, 3500);
  if (local.status === 404 && local.data && local.data.notFound === true) {
    return {
      status: 'not_found',
      message: 'CEP não encontrado. Preencha o endereço manualmente.',
    };
  }
  if (
    local.ok &&
    local.data &&
    typeof local.data.city === 'string' &&
    local.data.city.trim() &&
    typeof local.data.state === 'string' &&
    local.data.state.trim() &&
    local.data.source !== 'region-estimate'
  ) {
    return {
      status: 'found',
      data: {
        cep: formattedCep,
        street: String(local.data.street || '').trim(),
        neighborhood: String(local.data.neighborhood || '').trim(),
        city: String(local.data.city).trim(),
        state: String(local.data.state).trim().toUpperCase().slice(0, 2),
        source: 'api',
      },
    };
  }

  // 2. Direct ViaCEP lookup (works on static hosts like Vercel where /api/* does not exist)
  const viaCep = await fetchJsonWithTimeout(
    `https://viacep.com.br/ws/${digits}/json/`,
    fetchImpl,
    4500
  );
  if (viaCep.ok && viaCep.data) {
    if (viaCep.data.erro === true || viaCep.data.erro === 'true') {
      return {
        status: 'not_found',
        message: 'CEP não encontrado. Confira os 8 dígitos ou preencha manualmente.',
      };
    }
    const city = String(viaCep.data.localidade || '').trim();
    const state = String(viaCep.data.uf || '').trim().toUpperCase().slice(0, 2);
    if (city && state) {
      return {
        status: 'found',
        data: {
          cep: formattedCep,
          street: String(viaCep.data.logradouro || '').trim(),
          neighborhood: String(viaCep.data.bairro || '').trim(),
          city,
          state,
          source: 'viacep',
        },
      };
    }
  }

  // 3. Direct BrasilAPI fallback
  const brasilApi = await fetchJsonWithTimeout(
    `https://brasilapi.com.br/api/cep/v1/${digits}`,
    fetchImpl,
    4500
  );
  if (brasilApi.status === 404) {
    return {
      status: 'not_found',
      message: 'CEP não encontrado. Confira os 8 dígitos ou preencha manualmente.',
    };
  }
  if (brasilApi.ok && brasilApi.data) {
    const city = String(brasilApi.data.city || '').trim();
    const state = String(brasilApi.data.state || '').trim().toUpperCase().slice(0, 2);
    if (city && state) {
      return {
        status: 'found',
        data: {
          cep: formattedCep,
          street: String(brasilApi.data.street || '').trim(),
          neighborhood: String(brasilApi.data.neighborhood || '').trim(),
          city,
          state,
          source: 'brasilapi',
        },
      };
    }
  }

  return {
    status: 'error',
    message: 'Não foi possível consultar o CEP automaticamente. Preencha o endereço manualmente.',
  };
}
