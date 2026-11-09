import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import type { Relation } from 'typeorm';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  tipo: string;

  @Column({ name: 'evento_id', type: 'varchar', length: 64, nullable: true, unique: true })
  eventoId: string | null;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @Column({ length: 30, default: 'ACTIVA' })
  estado: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;
}