import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Alerta } from './alerta.entity';

@Entity('cuarteles')
export class Cuartel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 255, nullable: true })
  direccion: string;

  @Column({ length: 100, nullable: true })
  comuna: string;

  @Column('numeric', { precision: 10, scale: 7 })
  latitud: number;

  @Column('numeric', { precision: 10, scale: 7 })
  longitud: number;

  @Column({ length: 20, nullable: true })
  telefono: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @OneToMany(() => Alerta, (alerta) => alerta.cuartel)
  alertas: Alerta[];
}