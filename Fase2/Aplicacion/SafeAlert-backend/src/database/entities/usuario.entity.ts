import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ContactoEmergencia } from './contacto-emergencia.entity';
import { Alerta } from './alerta.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 20 })
  telefono: string;

  @Column({ length: 150, unique: true })
  email: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @OneToMany(() => ContactoEmergencia, (contacto) => contacto.usuario)
  contactos: ContactoEmergencia[];

  @OneToMany(() => Alerta, (alerta) => alerta.usuario)
  alertas: Alerta[];
}