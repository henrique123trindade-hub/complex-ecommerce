import fs from 'node:fs';
import path from 'node:path';

interface CliArgs {
  uid: string;
  email: string;
  confirm: boolean;
  accessToken: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--confirm') {
      args.confirm = true;
    } else if (token.startsWith('--') && i + 1 < argv.length) {
      args[token.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return {
    uid: String(args.uid || '').trim(),
    email: String(args.email || '').trim().toLowerCase(),
    confirm: Boolean(args.confirm),
    accessToken: String(args.token || process.env.FIREBASE_ACCESS_TOKEN || '').trim(),
  };
}

async function run() {
  const { uid, email, confirm, accessToken } = parseArgs(process.argv.slice(2));
  if (!uid || !email || !email.includes('@') || !confirm) {
    console.error(
      'Uso obrigatório: npx tsx scripts/promote-admin.ts --uid <FIREBASE_UID> --email <EMAIL_VERIFICADO> --confirm [--token <OAUTH_ACCESS_TOKEN>]'
    );
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
    console.error('Erro: UID inválido.');
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
    projectId: string;
    firestoreDatabaseId?: string;
  };
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId || '(default)';

  if (!accessToken) {
    console.error(
      'Token de acesso GCP/Firebase ausente. Forneça --token <ACCESS_TOKEN> ou FIREBASE_ACCESS_TOKEN para autenticar a escrita administrativa no Firestore REST.'
    );
    process.exit(1);
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents`;

  const nowIso = new Date().toISOString();

  // 1. Write /admins/{uid}
  const adminRes = await fetch(`${baseUrl}/admins/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: uid },
        email: { stringValue: email },
        role: { stringValue: 'admin' },
        active: { booleanValue: true },
        grantedBy: { stringValue: 'cli-promote-admin' },
        grantedAt: { timestampValue: nowIso },
      },
    }),
  });

  if (!adminRes.ok) {
    const text = await adminRes.text();
    console.error(`Falha ao gravar /admins/${uid} (${adminRes.status}): ${text}`);
    process.exit(1);
  }

  // 2. Patch /users/{uid} role to admin if profile already exists
  const userUrl = `${baseUrl}/users/${encodeURIComponent(
    uid
  )}?updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt`;
  const userRes = await fetch(userUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        role: { stringValue: 'admin' },
        updatedAt: { timestampValue: nowIso },
      },
    }),
  });

  if (!userRes.ok && userRes.status !== 404) {
    const text = await userRes.text();
    console.warn(`Aviso ao atualizar /users/${uid}: ${text}`);
  }

  console.log(`Conta ${uid} (${email}) promovida a administrador em ${projectId}/${databaseId}.`);
}

run().catch((err) => {
  console.error('Erro inesperado na promoção administrativa:', err instanceof Error ? err.message : err);
  process.exit(1);
});
