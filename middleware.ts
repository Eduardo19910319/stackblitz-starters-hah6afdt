import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/'], // Protege a página principal
};

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Usuário será sempre 'admin' e a senha vem da variável que criamos
    // Se não tiver variável definida (dev), a senha padrão é 'admin'
    const validPassword = process.env.SENTINEL_PASSWORD || 'admin';

    if (user === 'admin' && pwd === validPassword) {
      return NextResponse.next();
    }
  }

  // Se não tiver senha, bloqueia e pede autenticação
  return new NextResponse('Acesso Negado: Área Restrita Sentinel.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
