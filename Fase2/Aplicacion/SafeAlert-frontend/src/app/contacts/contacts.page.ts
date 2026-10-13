import { Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { Subject, finalize, takeUntil } from 'rxjs';
import { ContactsService } from './contacts.service';
import { ContactoEmergencia } from './contacts.models';

function validarNombre(control: AbstractControl): ValidationErrors | null {
  return String(control.value).trim().length >= 2 ? null : { nombre: true };
}
function validarTelefono(control: AbstractControl): ValidationErrors | null {
  return /^\+[1-9]\d{7,14}$/.test(String(control.value).replace(/[\s()-]/g, '')) ? null : { telefono: true };
}

@Component({
  selector: 'app-contacts', standalone: true,
  imports: [IonicModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contacts.page.html', styleUrls: ['./contacts.page.scss'],
})
export class ContactsPage {
  @ViewChild('contactEditor') private contactEditor?: ElementRef<HTMLElement>;
  private readonly api = inject(ContactsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewLeft = new Subject<void>();
  readonly contactos = signal<ContactoEmergencia[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<'loading' | 'ready' | 'error' | 'unauthorized'>('loading');
  readonly demo = signal(false);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);
  readonly editando = signal<number | null>(null);
  readonly porEliminar = signal<ContactoEmergencia | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly filtrados = computed(() => {
    const query = this.busqueda().trim().toLocaleLowerCase('es');
    return this.contactos().filter(c => [c.nombre, c.telefono, c.relacion ?? ''].some(value => value.toLocaleLowerCase('es').includes(query)));
  });
  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, validarNombre, Validators.maxLength(100)]],
    telefono: ['', [Validators.required, validarTelefono]],
    relacion: ['', Validators.maxLength(50)],
  });

  ionViewWillEnter() { if (!this.demo()) this.cargar(); }
  ionViewDidLeave() { this.viewLeft.next(); this.porEliminar.set(null); }

  cargar() {
    if (this.guardando() || this.eliminando()) return;
    this.demo.set(false);
    this.porEliminar.set(null);
    this.estado.set('loading');
    this.contactos.set([]);
    this.busqueda.set('');
    this.cancelarEdicion();
    this.error.set('');
    this.mensaje.set('');
    this.api.listar().pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft)).subscribe({
      next: res => { this.contactos.set(res.contactos); this.estado.set('ready'); },
      error: (err: unknown) => { this.estado.set(err instanceof HttpErrorResponse && err.status === 401 ? 'unauthorized' : 'error'); },
    });
  }
  verEjemplo() {
    this.porEliminar.set(null);
    this.demo.set(true);
    this.estado.set('ready');
    this.error.set('');
    this.mensaje.set('');
    this.busqueda.set('');
    this.cancelarEdicion();
    this.contactos.set([
      { id: -1, nombre: 'Sofía Martínez', telefono: '+56900000001', relacion: 'Hermana' },
      { id: -2, nombre: 'Diego González', telefono: '+56900000002', relacion: 'Amigo' },
      { id: -3, nombre: 'Valentina Rojas', telefono: '+56900000003', relacion: 'Pareja' },
    ]);
  }
  invalido(campo: keyof typeof this.form.controls) {
    const control = this.form.controls[campo];
    return control.touched && control.invalid;
  }
  iniciales(nombre: string) { return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }
  abrirFormulario() {
    this.contactEditor?.nativeElement.scrollIntoView({ block: 'start' });
    this.contactEditor?.nativeElement.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }
  nuevoContacto() {
    if (this.guardando() || this.eliminando()) return;
    this.porEliminar.set(null);
    this.cancelarEdicion();
    this.error.set('');
    this.mensaje.set('');
    this.abrirFormulario();
  }
  editar(contacto: ContactoEmergencia) {
    if (this.guardando() || this.eliminando()) return;
    this.editando.set(contacto.id);
    this.porEliminar.set(null);
    this.form.reset({ nombre: contacto.nombre, telefono: contacto.telefono, relacion: contacto.relacion ?? '' });
    this.error.set('');
    this.mensaje.set('');
    this.abrirFormulario();
  }
  cancelarEdicion() { this.editando.set(null); this.form.reset(); }
  guardar() {
    if (this.guardando() || this.eliminando() || this.estado() !== 'ready') return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    const datos = { nombre: values.nombre.trim(), telefono: values.telefono.replace(/[\s()-]/g, ''), relacion: values.relacion.trim() || null };
    if (this.contactos().some(c => c.id !== this.editando() && c.telefono.replace(/[\s()-]/g, '') === datos.telefono)) {
      this.error.set('Ya tienes un contacto con ese número de teléfono.');
      return;
    }
    this.error.set('');
    this.mensaje.set('');
    const id = this.editando();
    if (this.demo()) {
      this.aplicarContacto({ id: id ?? Math.min(0, ...this.contactos().map(c => c.id)) - 1, ...datos });
      this.busqueda.set('');
      this.mensaje.set('Ejemplo actualizado. Estos cambios no se guardan en tu cuenta.');
      this.cancelarEdicion();
      return;
    }
    this.guardando.set(true);
    const request = id === null ? this.api.crear(datos) : this.api.actualizar(id, datos);
    request.pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft), finalize(() => this.guardando.set(false))).subscribe({
      next: res => {
        this.aplicarContacto(res.contacto);
        this.busqueda.set('');
        this.estado.set('ready');
        this.mensaje.set(id === null ? 'Contacto agregado a tu red de confianza.' : 'Datos del contacto actualizados.');
        this.cancelarEdicion();
      },
      error: (err: unknown) => this.mostrarError(err),
    });
  }
  confirmarEliminar() {
    const contacto = this.porEliminar();
    if (!contacto || this.guardando() || this.eliminando()) return;
    this.error.set('');
    this.mensaje.set('');
    if (this.demo()) {
      this.quitarContacto(contacto.id);
      this.mensaje.set('Contacto retirado del ejemplo. Tu cuenta no ha cambiado.');
      return;
    }
    this.eliminando.set(true);
    this.api.eliminar(contacto.id).pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft), finalize(() => this.eliminando.set(false))).subscribe({
      next: () => { this.quitarContacto(contacto.id); this.mensaje.set('Contacto eliminado de tu red de confianza.'); },
      error: (err: unknown) => this.mostrarError(err),
    });
  }
  private aplicarContacto(contacto: ContactoEmergencia) {
    this.contactos.update(items => items.some(c => c.id === contacto.id) ? items.map(c => c.id === contacto.id ? contacto : c) : [...items, contacto]);
  }
  private quitarContacto(id: number) {
    this.contactos.update(items => items.filter(c => c.id !== id));
    this.porEliminar.set(null);
    if (this.editando() === id) this.cancelarEdicion();
  }
  private mostrarError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.contactos.set([]);
      this.estado.set('unauthorized');
      this.porEliminar.set(null);
      this.cancelarEdicion();
      this.error.set('Tu sesión no está disponible. Inicia sesión para continuar.');
    } else if (error instanceof HttpErrorResponse && error.status === 409) {
      this.error.set('Ya existe un contacto con ese teléfono.');
    } else if (error instanceof HttpErrorResponse && error.status === 400) {
      this.error.set('Revisa los datos del contacto y vuelve a intentarlo.');
    } else {
      this.error.set('No pudimos confirmar el cambio. Revisa la conexión y vuelve a intentarlo.');
    }
  }
}
