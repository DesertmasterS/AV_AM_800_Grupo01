import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Cuartel } from './cuartel.entity';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'EMERGENCIA_SOS' })
  tipo: string;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  latitud: number;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  longitud: number;

  @Column({ default: 'PENDIENTE' })
  estado: string;

  @Column({ name: 'mensaje_policia_estado', default: 'PENDIENTE' })
  mensajePoliciaEstado: string;

  @CreateDateColumn()
  fecha: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.alertas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @ManyToOne(() => Cuartel, (cuartel) => cuartel.alertas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'cuartel_id' })
  cuartel: Cuartel | null;
}