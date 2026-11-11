import { TestBed } from '@angular/core/testing';
import { BatteryService } from './battery.service';

describe('BatteryService', () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'getBattery');
  afterEach(() => {
    if (descriptor) Object.defineProperty(navigator, 'getBattery', descriptor);
    else Reflect.deleteProperty(navigator, 'getBattery');
  });
  it.each([0, 0.37, 1])('lee el porcentaje disponible: %s', async level => {
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: async () => ({ level }) });
    expect(await TestBed.inject(BatteryService).readPercentage()).toBe(Math.round(level * 100));
  });
  it('no impide la alerta cuando la lectura falla', async () => {
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: async () => { throw new Error('unavailable'); } });
    expect(await TestBed.inject(BatteryService).readPercentage()).toBeUndefined();
  });
});
