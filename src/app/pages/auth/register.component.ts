import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Form data
  email = '';
  password = '';
  confirmPassword = '';
  firstName = '';
  lastName = '';

  // UI state
  showPassword = false;
  showConfirmPassword = false;
  loading = signal(false);
  error = signal('');
  success = signal(false);

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    
    try {
      // Client-side validation
      if (this.password !== this.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (this.password.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères');
      }

      // Register user via Directus
      await this.auth.register({
        email: this.email,
        password: this.password,
        first_name: this.firstName,
        last_name: this.lastName
      });

      this.success.set(true);
      
      // Redirect to login after 2 seconds
      setTimeout(async () => {
        await this.router.navigateByUrl('/login');
      }, 2000);

    } catch (e: any) {
      const message = e?.message ?? 'Échec de l\'inscription';
      this.error.set(this.translateError(message));
    } finally {
      this.loading.set(false);
    }
  }

  private translateError(message: string): string {
    const translations: Record<string, string> = {
      'Invalid payload. "email" must be a valid email.': 'L\'email doit être une adresse email valide.',
      '"email" must be a valid email': 'L\'email doit être une adresse email valide.',
      'Field "email" has to be unique.': 'Cet email est déjà utilisé.',
      '"password" is required': 'Le mot de passe est requis.',
      '"email" is required': 'L\'email est requis.',
      '"first_name" is required': 'Le prénom est requis.',
      '"last_name" is required': 'Le nom est requis.',
      '"password" is not allowed to be empty': 'Le mot de passe ne peut pas être vide.',
    };
    
    for (const [key, value] of Object.entries(translations)) {
      if (message.includes(key)) return value;
    }
    
    return message;
  }
}
