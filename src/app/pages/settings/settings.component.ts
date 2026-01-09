import { Component, OnInit, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Api } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';

type MeResponse = {
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    description?: string | null;
    avatar?: string | { id: string } | null;
  };
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly DIRECTUS_URL: string = environment.directusUrl;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  private userId: string | null = null;
  avatarUrl?: string;
  avatarPreviewUrl?: string; // Prévisualisation locale avant upload
  private avatarFileId: string | null = null;

  form = this.fb.nonNullable.group({
    first_name: ['', [Validators.maxLength(255)]],
    last_name: ['', [Validators.maxLength(255)]],
    description: ['']
  });

  constructor() {
    afterNextRender(async () => {
      const token = this.auth.accessToken;
      if (!token) {
        await this.router.navigate(['/login']);
        return;
      }
      await this.loadMe();
    });
  }

  async ngOnInit(): Promise<void> {}

  private async loadMe(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const token = this.auth.accessToken;
      if (!token) return;
      const res = await this.api.getMe(token, 'id,first_name,last_name,description,avatar').toPromise();
      const u = res?.data;
      if (!u) return;
      this.userId = u.id;
      this.form.patchValue({
        first_name: u.first_name ?? '',
        last_name: u.last_name ?? '',
        description: u.description ?? ''
      });
      const avatarId = typeof u.avatar === 'string' ? u.avatar : (u.avatar && typeof u.avatar === 'object' ? u.avatar.id : undefined);
      this.avatarFileId = avatarId ?? null;
      this.avatarUrl = avatarId ? `${this.DIRECTUS_URL}/assets/${avatarId}?width=160&height=160&fit=cover&quality=80` : undefined;
    } catch (e: any) {
      this.error.set('Impossible de charger vos informations.');
    } finally {
      this.loading.set(false);
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.error.set(null);
    
    // Afficher immédiatement la prévisualisation locale
    this.avatarPreviewUrl = URL.createObjectURL(file);
    
    try {
      // Utiliser Api pour l'upload
      const uploaded = await this.api.uploadFile(file).toPromise();
      const fid = uploaded?.data?.id;
      if (fid) {
        this.avatarFileId = fid;
        this.avatarUrl = `${this.DIRECTUS_URL}/assets/${fid}?width=160&height=160&fit=cover&quality=80`;
        // Libérer l'URL de prévisualisation après upload réussi
        if (this.avatarPreviewUrl) {
          URL.revokeObjectURL(this.avatarPreviewUrl);
          this.avatarPreviewUrl = undefined;
        }
      }
    } catch (e) {
      this.error.set("Échec de l'envoi de l'avatar.");
      // Garder la prévisualisation même en cas d'erreur pour que l'utilisateur voie ce qu'il a choisi
    }
  }

  async save(): Promise<void> {
    if (!this.userId) return;
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const body: any = {
        first_name: this.form.value.first_name ?? null,
        last_name: this.form.value.last_name ?? null,
        description: this.form.value.description ?? null,
      };
      if (this.avatarFileId) body.avatar = this.avatarFileId;
      await this.api.updateUser(this.userId, body).toPromise();
      // Redirection vers la page de profil après sauvegarde réussie
      await this.router.navigate(['/profile']);
    } catch (e) {
      this.error.set('Impossible de sauvegarder les modifications.');
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    history.back();
  }
}


