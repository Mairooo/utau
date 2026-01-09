import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  showPassword = false;
  loading = signal(false);
  error = signal('');

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/');
    } catch (e: any) {
      // Traduire les messages d'erreur courants
      const message = e?.message ?? 'Échec de la connexion';
      this.error.set(this.translateError(message));
    } finally {
      this.loading.set(false);
    }
  }

  private translateError(message: string): string {
    const translations: Record<string, string> = {
      'Invalid payload. "email" must be a valid email.': 'L\'email doit être une adresse email valide.',
      'Invalid user credentials.': 'Identifiants incorrects.',
      'Invalid credentials.': 'Identifiants incorrects.',
      '"password" is required': 'Le mot de passe est requis.',
      '"email" is required': 'L\'email est requis.',
      '"password" is not allowed to be empty': 'Le mot de passe ne peut pas être vide.',
      '"email" is not allowed to be empty': 'L\'email ne peut pas être vide.',
    };
    
    // Chercher une traduction exacte ou partielle
    for (const [key, value] of Object.entries(translations)) {
      if (message.includes(key)) return value;
    }
    
    return message;
  }
}


