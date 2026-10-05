import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { Subject, finalize, takeUntil } from 'rxjs';
import { AuthService } from './auth.service';

function telefonoInternacional(control: AbstractControl): ValidationErrors | null {
  return /^\+[1-9]\d{7,14}$/.test(String(control.value).replace(/[\s()-]/g, '')) ? null : { telefono: true };
}
function nombreValido(control: AbstractControl): ValidationErrors | null {
  return String(control.value).trim().length >= 2 ? null : { nombre: true };
}

@Component({
  selector: 'app-account', standalone: true,
  imports: [IonicModule, RouterLink, ReactiveFormsModule],
  templateUrl: './account.page.html', styleUrls: ['./account.page.scss'],
})
export class AccountPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewLeft = new Subject<void>();
  readonly registro = inject(ActivatedRoute).snapshot.data['registro'] === true;
  readonly fieldPrefix = this.registro ? 'register' : 'login';
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly mostrarClave = signal(false);
  readonly form = this.fb.nonNullable.group({
    nombre: ['', this.registro ? [Validators.required, nombreValido, Validators.maxLength(100)] : []],
    apellido: ['', this.registro ? [Validators.required, nombreValido, Validators.maxLength(100)] : []],
    telefono: ['', this.registro ? [Validators.required, telefonoInternacional] : []],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', this.registro ? [Validators.required, Validators.minLength(8), Validators.maxLength(128)] : [Validators.required, Validators.maxLength(128)]],
  });

  invalido(campo: keyof typeof this.form.controls) {
    const control = this.form.controls[campo];
    return control.touched && control.invalid;
  }

  enviar() {
    if (this.enviando()) return;
    this.form.controls.email.setValue(this.form.controls.email.value.trim());
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const datos = this.form.getRawValue();
    this.error.set('');
    this.enviando.set(true);
    const request = this.registro
      ? this.auth.registrar({ ...datos, nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email: datos.email.toLowerCase(), telefono: datos.telefono.replace(/[\s()-]/g, '') })
      : this.auth.iniciarSesion({ email: datos.email.toLowerCase(), password: datos.password });
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.viewLeft),
      finalize(() => this.enviando.set(false)),
    ).subscribe({
      next: () => {
        this.form.reset();
        void this.router.navigateByUrl('/profile', { replaceUrl: true });
      },
      error: (error: unknown) => {
        this.form.controls.password.reset();
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.error.set('El correo o la clave no son correctos.');
        } else if (error instanceof HttpErrorResponse && error.status === 409) {
          this.error.set('Ya existe una cuenta con este correo. Puedes iniciar sesión.');
        } else if (error instanceof HttpErrorResponse && error.status === 400) {
          this.error.set('Revisa los datos ingresados y vuelve a intentarlo.');
        } else if (error instanceof HttpErrorResponse && error.status === 429) {
          this.error.set('Hay demasiados intentos. Espera unos minutos antes de volver a probar.');
        } else {
          this.error.set('No pudimos conectar con el servicio de cuentas. Inténtalo más tarde.');
        }
      },
    });
  }

  ionViewDidLeave() {
    this.viewLeft.next();
    this.form.controls.password.reset();
    this.mostrarClave.set(false);
    this.error.set('');
  }
}
