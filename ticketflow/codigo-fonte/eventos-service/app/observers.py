"""Padrão Observer: quem precisa reagir à alteração de um evento se cadastra como ouvinte.

O EventoService só publica a mudança; não conhece Notificações nem auditoria.
"""
import logging
import os
from abc import ABC, abstractmethod

import httpx

from .models import Evento

log = logging.getLogger("eventos")


class EventoListener(ABC):
    """Interface dos ouvintes (Observer)."""

    @abstractmethod
    def evento_alterado(self, evento: Evento, alteracoes: dict) -> None: ...


class AuditoriaListener(EventoListener):
    """Registra a alteração em log."""

    def evento_alterado(self, evento: Evento, alteracoes: dict) -> None:
        log.info("AUDITORIA evento %s alterado: %s", evento.id, alteracoes)


class NotificacaoListener(EventoListener):
    """Pede ao Serviço de Notificações o aviso aos compradores do evento.

    Se Notificações estiver fora do ar, a falha é apenas registrada: a alteração
    do evento já foi salva e o organizador recebe 200.
    """

    def __init__(self, base_url: str | None = None, timeout: float = 2.0):
        self.base_url = (base_url or os.getenv("NOTIFICACOES_URL", "http://localhost:8084")).rstrip("/")
        self.timeout = timeout

    def evento_alterado(self, evento: Evento, alteracoes: dict) -> None:
        campos = {"nome": "nome", "local": "local", "data": "data e hora", "preco": "preço", "capacidade": "capacidade"}
        mudou = ", ".join(campos.get(c, c) for c in alteracoes) or "dados"
        quando = evento.data.strftime("%d/%m/%Y às %H:%M")
        corpo = {
            "assunto": f"Alteração no evento {evento.nome}",
            "mensagem": f"O evento {evento.nome} teve alteração de {mudou}. Agora: {evento.local}, {quando}.",
        }
        try:
            r = httpx.post(f"{self.base_url}/notificacoes/eventos/{evento.id}/broadcast", json=corpo, timeout=self.timeout)
            r.raise_for_status()
            log.info("Aviso do evento %s enviado: %s", evento.id, r.json())
        except httpx.HTTPError as e:
            log.warning("Serviço de Notificações indisponível; aviso do evento %s não enviado (%s)", evento.id, e)
