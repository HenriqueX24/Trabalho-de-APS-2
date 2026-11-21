import { useCallback, useEffect, useRef, useState } from 'react';
import { mensagemDoErro } from '../api/errors';

/** Carrega dados assíncronos com estados de carregamento e erro, e permite recarregar. */
export function useCarga<T>(carregar: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(carregar, deps);

  const recarregar = useCallback(async () => {
    const minha = ++seq.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fn();
      if (minha === seq.current) setDados(r);
    } catch (e) {
      if (minha === seq.current) setErro(mensagemDoErro(e));
    } finally {
      if (minha === seq.current) setCarregando(false);
    }
  }, [fn]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dados, erro, carregando, recarregar, setDados };
}
