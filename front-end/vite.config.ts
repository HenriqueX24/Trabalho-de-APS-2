import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /svc/<servico> é repassado ao microsserviço (evita CORS).
// Os destinos podem ser trocados com EVENTOS_TARGET etc. (ex.: outro host).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const alvo = (nome: string, porta: number) => ({
    target: env[`${nome.toUpperCase()}_TARGET`] ?? `http://localhost:${porta}`,
    changeOrigin: true,
    rewrite: (p: string) => p.replace(new RegExp(`^/svc/${nome}`), ''),
  });
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/svc/eventos': alvo('eventos', 8081),
        '/svc/ingressos': alvo('ingressos', 8082),
        '/svc/pagamento': alvo('pagamento', 8083),
        '/svc/notificacoes': alvo('notificacoes', 8084),
      },
    },
  };
});
