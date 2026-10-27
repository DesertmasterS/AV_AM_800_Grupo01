import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Cuartel } from './cuartel.entity';

@Entity('alertas')
@Index('uq_alertas_usuario_evento', ['usuario', 'eventoId'], { unique: true, where: '"evento_id" IS NOT NULL' })
export class Alerta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'EMERGENCIA_SOS' })
  tipo: string;

  @Column({ name: 'evento_id', type: 'uuid', nullable: true })
  eventoId: string | null;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column('numeric', { precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @Column({ default: 'PENDIENTE' })
  estado: string;

  @Column({ name: 'mensaje_policia_estado', default: 'PENDIENTE' })
  mensajePoliciaEstado: string;

  @CreateDateColumn({ type: 'timestamp', default: () => "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')" })
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
