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

  @ManyToOne(() => Usuario, (usuario) => usuario.contactos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
