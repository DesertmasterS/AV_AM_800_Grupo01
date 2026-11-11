import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface SosDevicePlugin {
  getBattery(): Promise<{ bateriaPorcentaje?: number }>;
}
const SosDevice = registerPlugin<SosDevicePlugin>('SosDevice');
type BatteryNavigator = Navigator & { getBattery?: () => Promise<{ level: number }> };

@Injectable({ providedIn: 'root' })
export class BatteryService {
  async readPercentage(): Promise<number | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Una API lenta o no compatible nunca debe bloquear el SOS.
      return await Promise.race([
        this.readDevice(),
        new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 800); }),
      ]);
    } catch {
      return undefined;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async readDevice(): Promise<number | undefined> {
    let percentage: number | undefined;
    if (Capacitor.getPlatform() === 'android') {
      percentage = (await SosDevice.getBattery()).bateriaPorcentaje;
    } else if (typeof navigator !== 'undefined') {
      const battery = await (navigator as BatteryNavigator).getBattery?.();
      if (battery && Number.isFinite(battery.level) && battery.level >= 0 && battery.level <= 1) {
        percentage = Math.round(battery.level * 100);
      }
    }
    return Number.isInteger(percentage) && percentage! >= 0 && percentage! <= 100 ? percentage : undefined;
  }
}
