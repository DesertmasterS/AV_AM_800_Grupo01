import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import type { Relation } from 'typeorm';

@Entity('contactos_emergencia')
export class ContactoEmergencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relacion: string | null;

  @Column({ type: 'boolean', default: false })
  confirmado: boolean;

  @Column({ name: 'token_confirmacion', type: 'varchar', length: 64, nullable: true, select: false })
  tokenConfirmacion: string | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.contactos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
  
  @Column({ type: 'boolean', default: false })
  rechazado: boolean;
  
  @Column({ name: 'notificar_activo', type: 'boolean', default: true })
  notificarActivo: boolean;
}