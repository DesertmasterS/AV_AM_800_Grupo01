import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'EMERGENCIA_SOS' })
  tipo: string;

  @CreateDateColumn()
  fecha: Date;
}