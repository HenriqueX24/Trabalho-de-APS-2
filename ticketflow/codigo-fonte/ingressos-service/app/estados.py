"""Padrão State: cada estado do pedido só permite as transições válidas.

    CRIADO ──reservar──▶ RESERVADO ──pagar──▶ PAGO ──concluir──▶ CONCLUIDO
       │                     │
       └──────cancelar───────┴──────────────▶ CANCELADO
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Pedido


class TransicaoInvalida(Exception):
    def __init__(self, estado: str, acao: str):
        super().__init__(f"Pedido no estado {estado} não permite {acao}.")
        self.estado = estado
        self.acao = acao


class EstadoPedido:
    nome = ""

    def _recusar(self, acao: str):
        raise TransicaoInvalida(self.nome, acao)

    def reservar(self, pedido: Pedido) -> None:
        self._recusar("reservar")

    def pagar(self, pedido: Pedido) -> None:
        self._recusar("pagar")

    def concluir(self, pedido: Pedido) -> None:
        self._recusar("concluir")

    def cancelar(self, pedido: Pedido, motivo: str) -> None:
        self._recusar("cancelar")


class Criado(EstadoPedido):
    nome = "CRIADO"

    def reservar(self, pedido: Pedido) -> None:
        pedido.mudar_estado(Reservado())

    def cancelar(self, pedido: Pedido, motivo: str) -> None:
        pedido.motivo = motivo
        pedido.mudar_estado(Cancelado())


class Reservado(EstadoPedido):
    nome = "RESERVADO"

    def pagar(self, pedido: Pedido) -> None:
        pedido.mudar_estado(Pago())

    def cancelar(self, pedido: Pedido, motivo: str) -> None:
        pedido.motivo = motivo
        pedido.mudar_estado(Cancelado())


class Pago(EstadoPedido):
    nome = "PAGO"

    def concluir(self, pedido: Pedido) -> None:
        pedido.mudar_estado(Concluido())


class Concluido(EstadoPedido):
    nome = "CONCLUIDO"


class Cancelado(EstadoPedido):
    nome = "CANCELADO"


ESTADOS: dict[str, type[EstadoPedido]] = {c.nome: c for c in (Criado, Reservado, Pago, Concluido, Cancelado)}
