export class WalletService {
  constructor(userRepo, walletRepo) {
    this.userRepo = userRepo;
    this.walletRepo = walletRepo;
  }

  // Obtener el saldo del usuario
  async getSaldo(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    return { saldo: user.saldo };
  }

  // Recargar saldo
  async recargar(userId, monto, metodo = 'SIMULADO') {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    
    const nuevoSaldo = user.saldo + monto;
    await this.userRepo.updateSaldo(userId, nuevoSaldo);

    return await this.walletRepo.createTransaccion({
      usuario_id: userId,
      tipo: 'RECARGA',
      monto: monto,
      saldo_resultante: nuevoSaldo,
      referencia: metodo,
      estado: 'COMPLETADO'
    });
  }

  // Pagar (descontar saldo)
  async pagar(userId, monto, referencia) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    if (user.saldo < monto) throw new Error('Saldo insuficiente');

    const nuevoSaldo = user.saldo - monto;
    await this.userRepo.updateSaldo(userId, nuevoSaldo);

    return await this.walletRepo.createTransaccion({
      usuario_id: userId,
      tipo: 'COMPRA',
      monto: -monto,
      saldo_resultante: nuevoSaldo,
      referencia: referencia,
      estado: 'COMPLETADO'
    });
  }
}