"""Padrão Strategy: cada canal envia a mensagem do seu jeito (envio simulado, gravado em log)."""
import logging
from abc import ABC, abstractmethod

log = logging.getLogger("notificacoes")


class CanalEnvio(ABC):
    """Interface comum dos canais."""

    @abstractmethod
    def enviar(self, destinatario: str, assunto: str, mensagem: str) -> bool: ...


class EmailCanal(CanalEnvio):
    def enviar(self, destinatario: str, assunto: str, mensagem: str) -> bool:
        if "@" not in destinatario:
            log.warning("E-mail inválido: %s", destinatario)
            return False
        log.info("[EMAIL] para=%s assunto=%r mensagem=%r", destinatario, assunto, mensagem)
        return True


class SmsCanal(CanalEnvio):
    def enviar(self, destinatario: str, assunto: str, mensagem: str) -> bool:
        numero = "".join(c for c in destinatario if c.isdigit())
        if len(numero) < 8:
            log.warning("Telefone inválido: %s", destinatario)
            return False
        # SMS não tem assunto: vai só o texto, limitado a 160 caracteres.
        log.info("[SMS] para=%s texto=%r", numero, f"{assunto}: {mensagem}"[:160])
        return True


# Um canal novo (ex.: push) é uma classe nova registrada aqui.
CANAIS: dict[str, CanalEnvio] = {
    "EMAIL": EmailCanal(),
    "SMS": SmsCanal(),
}
