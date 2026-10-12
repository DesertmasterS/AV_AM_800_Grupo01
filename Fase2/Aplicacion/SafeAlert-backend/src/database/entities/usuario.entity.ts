import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContactoEmergencia } from './contacto-emergencia.entity';
import { Alerta } from './alerta.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  apellido: string;

  @Column({ length: 20 })
  telefono: string;

  @Column({ length: 150, unique: true })
  email: string;

  // select: false evita que el hash viaje en consultas normales por accidente
  @Column({ name: 'password_hash', length: 255, nullable: true, select: false })
  passwordHash: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @OneToMany(() => ContactoEmergencia, (c) => c.usuario)
  contactos: ContactoEmergencia[];

  @OneToMany(() => Alerta, (a) => a.usuario)
  alertas: Alerta[];
}