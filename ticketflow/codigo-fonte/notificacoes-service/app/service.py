from sqlalchemy import select
from sqlalchemy.orm import Session

from .canais import CANAIS, CanalEnvio
from .models import DestinatarioEvento, Notificacao


class CanalInvalido(Exception):
    pass


class NotificacaoService:
    def __init__(self, db: Session, canais: dict[str, CanalEnvio] | None = None):
        self.db = db
        self.canais = canais or CANAIS

    def _enviar(self, destinatario: str, canal: str, assunto: str, mensagem: str, evento_id: int | None) -> Notificacao:
        estrategia = self.canais.get(canal)
        if estrategia is None:
            raise CanalInvalido(f"Canal não suportado: {canal}.")
        ok = estrategia.enviar(destinatario, assunto, mensagem)
        n = Notificacao(
            destinatario=destinatario,
            canal=canal,
            assunto=assunto,
            mensagem=mensagem,
            evento_id=evento_id,
            status="ENVIADA" if ok else "FALHA",
        )
        self.db.add(n)
        return n

    def enviar(self, destinatario: str, canal: str, assunto: str, mensagem: str, evento_id: int | None = None) -> Notificacao:
        n = self._enviar(destinatario, canal, assunto, mensagem, evento_id)
        # Quem recebe mensagem ligada a um evento passa a receber os avisos desse evento.
        if evento_id is not None:
            ja = self.db.scalar(
                select(DestinatarioEvento).where(
                    DestinatarioEvento.evento_id == evento_id, DestinatarioEvento.destinatario == destinatario
                )
            )
            if ja is None:
                self.db.add(DestinatarioEvento(evento_id=evento_id, destinatario=destinatario, canal=canal))
        self.db.commit()
        return n

    def broadcast(self, evento_id: int, assunto: str, mensagem: str) -> list[Notificacao]:
        destinatarios = self.db.scalars(
            select(DestinatarioEvento).where(DestinatarioEvento.evento_id == evento_id)
        ).all()
        enviadas = [self._enviar(d.destinatario, d.canal, assunto, mensagem, evento_id) for d in destinatarios]
        self.db.commit()
        return enviadas

    def historico(self, destinatario: str | None = None, evento_id: int | None = None) -> list[Notificacao]:
        q = select(Notificacao).order_by(Notificacao.id.desc())
        if destinatario:
            q = q.where(Notificacao.destinatario == destinatario)
        if evento_id is not None:
            q = q.where(Notificacao.evento_id == evento_id)
        return list(self.db.scalars(q.limit(200)))
