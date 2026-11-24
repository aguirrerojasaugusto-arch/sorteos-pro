import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  async register(data) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new Error('El email ya está registrado');

    const hash = await bcrypt.hash(data.password, 10);
    const nuevoUsuario = await this.userRepo.create({
      email: data.email,
      password_hash: hash,
      nombre: data.nombre,
      dni: data.dni,
      telefono: data.telefono
    });

    return { message: 'Usuario registrado con éxito', usuario: nuevoUsuario };
  }

  async login(data) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) throw new Error('Credenciales inválidas');

    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) throw new Error('Credenciales inválidas');

    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      process.env.JWT_SECRET || 'secreto', 
      { expiresIn: '7d' }
    );

    return { token, usuario: { id: user.id, email: user.email, nombre: user.nombre } };
  }
}