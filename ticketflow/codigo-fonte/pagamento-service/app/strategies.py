"""Padrão Strategy: cada meio de pagamento autoriza a cobrança do seu jeito (simulado)."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Autorizacao:
    aprovado: bool
    motivo: str | None = None


class MeioPagamento(ABC):
    """Interface comum das estratégias."""

    @abstractmethod
    def autorizar(self, valor: float, final_cartao: str | None = None) -> Autorizacao: ...


class CartaoStrategy(MeioPagamento):
    # Na simulação, o cartão de final 0000 é recusado (usado na demonstração).
    FINAL_RECUSADO = "0000"

    def autorizar(self, valor: float, final_cartao: str | None = None) -> Autorizacao:
        if not final_cartao or len(final_cartao) != 4 or not final_cartao.isdigit():
            return Autorizacao(False, "Final do cartão inválido.")
        if final_cartao == self.FINAL_RECUSADO:
            return Autorizacao(False, "Cartão recusado pela operadora.")
        return Autorizacao(True)


class PixStrategy(MeioPagamento):
    def autorizar(self, valor: float, final_cartao: str | None = None) -> Autorizacao:
        return Autorizacao(True)


class BoletoStrategy(MeioPagamento):
    def autorizar(self, valor: float, final_cartao: str | None = None) -> Autorizacao:
        return Autorizacao(True)


# Mapa meio -> estratégia. Um meio novo é uma classe nova registrada aqui.
ESTRATEGIAS: dict[str, MeioPagamento] = {
    "CARTAO": CartaoStrategy(),
    "PIX": PixStrategy(),
    "BOLETO": BoletoStrategy(),
}
