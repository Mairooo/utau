import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly DIRECTUS_URL: string = (globalThis as any).DIRECTUS_URL || 'http://localhost:8055';

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  private userId: string | null = null;
  avatarUrl?: string;
  private avatarFileId: string | null = null;

  form = this.fb.nonNullable.group({
    first_name: ['', [Validators.maxLength(255)]],
    last_name: ['', [Validators.maxLength(255)]],
    description: ['']
  });

  async ngOnInit(): Promise<void> {
    await this.loadMe();
  }

  private async loadMe(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.DIRECTUS_URL}/users/me?fields=id,first_name,last_name,description,avatar`;
      const res = await this.http.get<MeResponse>(url).toPromise();
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
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadUrl = `${this.DIRECTUS_URL}/files`;
      const uploaded = await this.http.post<{ data: { id: string } }>(uploadUrl, formData).toPromise();
      const fid = uploaded?.data?.id;
      if (fid) {
        this.avatarFileId = fid;
        this.avatarUrl = `${this.DIRECTUS_URL}/assets/${fid}?width=160&height=160&fit=cover&quality=80`;
      }
    } catch (e) {
      this.error.set("Échec de l'envoi de l'avatar.");
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
      const url = `${this.DIRECTUS_URL}/users/${encodeURIComponent(this.userId)}`;
      await this.http.patch<{ data: unknown }>(url, body).toPromise();
      this.success.set('Modifications enregistrées.');
    } catch (e) {
      this.error.set('Impossible de sauvegarder les modifications.');
    } finally {
      this.saving.set(false);
    }
  }
}


