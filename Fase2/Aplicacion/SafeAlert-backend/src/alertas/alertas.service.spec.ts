import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertasService } from './alertas.service';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { CrearAlertaDto, OrigenAlerta } from './dto/crear-alerta.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Alertas por movimiento', () => {
  const eventoId = 'd10f34b5-1678-41cd-9a14-36b686a62745';
  const repo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const usuarios = { findOne: jest.fn() };
  let service: AlertasService;
  beforeEach(async () => {
    jest.resetAllMocks();
    usuarios.findOne.mockResolvedValue({ id: 7 });
    repo.findOne.mockResolvedValue(null);
    repo.create.mockImplementation(data => data);
    repo.save.mockImplementation(async data => ({ ...data, id: 15, fecha: new Date('2026-10-17T12:00:00Z') }));
    const module = await Test.createTestingModule({
      providers: [AlertasService, { provide: getRepositoryToken(Alerta), useValue: repo }, { provide: getRepositoryToken(Usuario), useValue: usuarios }],
    }).compile();
    service = module.get(AlertasService);
  });

  it('registra origen y evento asociados al usuario, sin inventar ubicación', async () => {
    const res = await service.crearAlerta({ origen: OrigenAlerta.MOVIMIENTO, eventoId }, 7);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'EMERGENCIA_MOVIMIENTO', eventoId, latitud: null, longitud: null, usuario: { id: 7 },
    }));
    expect(res).toMatchObject({ id: 15, origen: 'MOVIMIENTO', eventoId, duplicada: false, usuarioId: 7 });
  });
  it('un reintento devuelve la misma alerta sin volver a guardarla', async () => {
    repo.findOne.mockResolvedValue({ id: 15, tipo: 'EMERGENCIA_MOVIMIENTO', eventoId });
    const res = await service.crearAlerta({ origen: OrigenAlerta.MOVIMIENTO, eventoId }, 7);
    expect(res.duplicada).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.findOne).toHaveBeenCalledWith({ where: { eventoId, usuario: { id: 7 } } });
  });
  it('acepta y conserva las coordenadas capturadas por Android', async () => {
    const dto = { origen: OrigenAlerta.MOVIMIENTO, eventoId, latitud: -33.45, longitud: -70.66 };
    expect(await validate(plainToInstance(CrearAlertaDto, dto))).toHaveLength(0);
    const res = await service.crearAlerta(dto, 7);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ latitud: -33.45, longitud: -70.66 }));
    expect(res).toMatchObject({ latitud: -33.45, longitud: -70.66, origen: 'MOVIMIENTO' });
  });
  it('un reintento conserva la ubicación del evento original', async () => {
    repo.findOne.mockResolvedValue({ id: 15, tipo: 'EMERGENCIA_MOVIMIENTO', eventoId, latitud: -33.45, longitud: -70.66 });
    const res = await service.crearAlerta({ origen: OrigenAlerta.MOVIMIENTO, eventoId, latitud: -34, longitud: -71 }, 7);
    expect(res).toMatchObject({ duplicada: true, latitud: -33.45, longitud: -70.66 });
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('resuelve la colisión de dos solicitudes concurrentes', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 15, tipo: 'EMERGENCIA_MOVIMIENTO', eventoId });
    repo.save.mockRejectedValue({ driverError: { code: '23505' } });
    const res = await service.crearAlerta({ origen: OrigenAlerta.MOVIMIENTO, eventoId }, 7);
    expect(res).toMatchObject({ id: 15, duplicada: true });
  });
  it('no oculta un error de base de datos no relacionado con duplicados', async () => {
    repo.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.crearAlerta({ origen: OrigenAlerta.MOVIMIENTO, eventoId }, 7)).rejects.toThrow('database unavailable');
  });
  it('el historial solo consulta alertas de la cuenta autenticada', async () => {
    repo.find.mockResolvedValue([]);
    await service.obtenerHistorial(7);
    expect(repo.find).toHaveBeenCalledWith({ where: { usuario: { id: 7 } }, order: { fecha: 'DESC' }, take: 20 });
  });
  it('rechaza una sesión ausente o una pareja de coordenadas incompleta', async () => {
    await expect(service.crearAlerta({}, undefined)).rejects.toThrow('usuario válido');
    await expect(service.crearAlerta({ latitud: -33 }, 7)).rejects.toThrow('ambas coordenadas');
  });
  it('valida evento obligatorio de movimiento y límites geográficos', async () => {
    const sinId = await validate(plainToInstance(CrearAlertaDto, { origen: 'MOVIMIENTO' }));
    expect(sinId.some(error => error.property === 'eventoId')).toBe(true);
    const invalido = await validate(plainToInstance(CrearAlertaDto, { origen: 'MOVIMIENTO', eventoId, latitud: 95, longitud: -200 }));
    expect(invalido.map(error => error.property)).toEqual(expect.arrayContaining(['latitud', 'longitud']));
    expect(await validate(plainToInstance(CrearAlertaDto, {}))).toHaveLength(0);
  });
});
