export class WalletService {
  constructor(userRepo, walletRepo) {
    this.userRepo = userRepo;
    this.walletRepo = walletRepo;
  }

  async getSaldo(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    return { saldo: user.saldo };
  }

  // `exec` opcional: permite ejecutar dentro de una transacción activa.
  async recargar(userId, monto, metodo = 'SIMULADO', exec = null) {
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');
    const { nuevoSaldo } = await this.walletRepo.acreditarSaldoAtomico(userId, monto, exec);
    return await this.walletRepo.createTransaccion({
      usuario_id: userId, tipo: 'RECARGA', monto,
      saldo_resultante: nuevoSaldo, referencia: metodo, estado: 'COMPLETADO'
    }, exec);
  }

  async pagar(userId, monto, referencia, exec = null) {
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');
    const { nuevoSaldo } = await this.walletRepo.debitarSaldoAtomico(userId, monto, exec);
    return await this.walletRepo.createTransaccion({
      usuario_id: userId, tipo: 'COMPRA', monto: -monto,
      saldo_resultante: nuevoSaldo, referencia, estado: 'COMPLETADO'
    }, exec);
  }
}