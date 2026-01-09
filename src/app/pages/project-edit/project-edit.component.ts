import { Component, OnInit, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { TagService } from '../../shared/services/tag.service';
import { Tag } from '../../shared/interfaces/tag.interface';
import { environment } from '../../../environments/environment';

interface Project {
  id?: string;
  title: string;
  description?: string;
  cover_image?: string | { id: string } | null;
  tempo?: number;
  key_signature?: string;
  status?: '0' | '1' | '2'; // 0 = draft, 1 = published, 2 = archived
  tags?: Array<{ Tags_id: { id: string; name: string } }>;
  rendered_audio?: string | { id: string } | null;
}

@Component({
  selector: 'app-project-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-edit.component.html',
  styleUrls: ['./project-edit.component.css']
})
export class ProjectEditComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly tagService = inject(TagService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly DIRECTUS_URL: string = environment.directusUrl;

  project: Project = {
    title: '',
    description: '',
    status: '0', // draft
    tags: []
  };

  coverImageUrl?: string;
  selectedCoverImage?: File;
  isLoading = false;
  isSaving = false;
  errorMessage?: string;
  activeSection: 'general' | 'audio' | 'visibility' = 'general';
  allTags: Tag[] = [];
  filteredTags: Tag[] = [];
  tagSearchQuery: string = '';
  currentUserId: string | null = null;

  tonalities = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  constructor() {
    afterNextRender(() => {
      this.loadCurrentUser();
      this.loadProject();
      this.loadAllTags();
    });
  }

  private loadCurrentUser(): void {
    const token = this.auth.accessToken;
    if (!token) return;
    
    this.api.getMe(token, 'id').subscribe({
      next: (response) => {
        this.currentUserId = response?.data?.id;
      },
      error: (err) => {
        console.error('Erreur lors de la récupération de l\'utilisateur:', err);
      }
    });
  }

  ngOnInit(): void {}

  private loadAllTags(): void {
    // Charger tous les tags pour la recherche
    this.tagService.getAllTags().subscribe({
      next: (response) => {
        this.allTags = response.data || [];
        this.updateFilteredTags();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des tags:', error);
      }
    });
  }

  private updateFilteredTags(): void {
    // Récupérer les IDs des tags sélectionnés
    const selectedTagIds = this.project.tags?.map(t => t.Tags_id.id) || [];
    
    // Récupérer les tags sélectionnés
    const selectedTags = this.allTags.filter(tag => selectedTagIds.includes(tag.id));
    
    // Calculer combien de places restent pour les propositions
    const remainingSlots = 6 - selectedTags.length;
    
    if (remainingSlots > 0) {
      // Filtrer les tags non sélectionnés et prendre les premiers pour compléter jusqu'à 6
      const unselectedTags = this.allTags.filter(tag => !selectedTagIds.includes(tag.id));
      const proposedTags = unselectedTags.slice(0, remainingSlots);
      
      // Combiner : tags sélectionnés + propositions (max 6 total)
      this.filteredTags = [...selectedTags, ...proposedTags];
    } else {
      // Si 6 tags ou plus sont sélectionnés, afficher seulement les sélectionnés
      this.filteredTags = selectedTags;
    }
  }

  private loadProject(): void {
    const projectId = this.route.snapshot.paramMap.get('id');
    
    if (!projectId || projectId === 'new') {
      // Nouveau projet
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.getProjectById(projectId).subscribe({
      next: (response: any) => {
        if (response?.data) {
          this.project = response.data;
          // Normaliser le statut si nécessaire
          if (!this.project.status) {
            this.project.status = '0'; // draft par défaut
          }
          this.updateCoverImageUrl();
          // Mettre à jour l'affichage des tags avec les tags du projet
          if (this.allTags.length > 0) {
            this.updateFilteredTags();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement du projet:', error);
        this.errorMessage = 'Impossible de charger le projet';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateCoverImageUrl(): void {
    if (!this.project.cover_image) return;
    
    const coverId = typeof this.project.cover_image === 'string' 
      ? this.project.cover_image 
      : this.project.cover_image.id;
    
    if (coverId) {
      this.coverImageUrl = `${this.DIRECTUS_URL}/assets/${coverId}?width=800&height=450&fit=cover&quality=80`;
    }
  }

  onCoverImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Valider le type de fichier (PNG ou JPG uniquement)
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        this.errorMessage = 'Seuls les fichiers PNG et JPG sont acceptés';
        input.value = ''; // Réinitialiser l'input
        this.cdr.detectChanges();
        return;
      }
      
      // Valider la taille (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB en bytes
      if (file.size > maxSize) {
        this.errorMessage = 'L\'image ne doit pas dépasser 10MB';
        input.value = ''; // Réinitialiser l'input
        this.cdr.detectChanges();
        return;
      }
      
      this.selectedCoverImage = file;
      this.errorMessage = undefined; // Effacer les erreurs précédentes
      
      // Prévisualisation
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.coverImageUrl = e.target?.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(this.selectedCoverImage);
    }
  }

  setActiveSection(section: 'general' | 'audio' | 'visibility'): void {
    this.activeSection = section;
  }

  openComposer(): void {
    if (this.project.id) {
      // Ouvrir le compositeur avec le projet existant
      this.router.navigate(['/composer'], { queryParams: { projectId: this.project.id } });
    } else {
      // Pour un nouveau projet, sauvegarder d'abord puis ouvrir le compositeur
      this.saveProject().then(() => {
        if (this.project.id) {
          this.router.navigate(['/composer'], { queryParams: { projectId: this.project.id } });
        }
      }).catch((error: any) => {
        console.error('Erreur lors de la sauvegarde avant ouverture du compositeur:', error);
      });
    }
  }

  async saveProject(): Promise<void> {
    if (!this.project.title?.trim()) {
      this.errorMessage = 'Le titre est obligatoire';
      return;
    }

    // Vérifier que l'audio est présent si le statut est "publié"
    if (this.project.status === '1') {
      if (!this.project.rendered_audio) {
        this.errorMessage = 'Vous devez créer l\'audio dans le compositeur avant de publier votre projet';
        this.activeSection = 'audio'; // Rediriger vers la section audio
        this.cdr.detectChanges();
        return;
      }
    }

    this.isSaving = true;
    this.errorMessage = undefined;
    this.cdr.detectChanges();

    try {
      const token = this.auth.accessToken;
      if (!token) {
        throw new Error('Non authentifié');
      }

      // Upload de l'image si nécessaire
      if (this.selectedCoverImage) {
        const uploadResponse = await this.api.uploadFile(this.selectedCoverImage).toPromise();
        if (uploadResponse?.data?.id) {
          this.project.cover_image = uploadResponse.data.id;
        }
      }

      // Préparer les données du projet pour l'API
      const projectData: any = {
        title: this.project.title,
        description: this.project.description,
        tempo: this.project.tempo,
        key_signature: this.project.key_signature,
        status: this.project.status,
      };

      // N'ajouter cover_image que si une nouvelle image a été uploadée
      if (this.selectedCoverImage && this.project.cover_image) {
        projectData.cover_image = typeof this.project.cover_image === 'object' && this.project.cover_image !== null 
          ? this.project.cover_image.id 
          : this.project.cover_image;
      }

      // Transformer les tags pour l'API (relation M2M via table de jonction)
      // Pour les mises à jour, on envoie seulement les IDs des tags
      if (this.project.id) {
        // Mise à jour : envoyer un tableau des IDs de tags uniquement
        if (this.project.tags && this.project.tags.length > 0) {
          projectData.tags = this.project.tags.map(t => ({
            Tags_id: t.Tags_id.id
          }));
        } else {
          projectData.tags = [];
        }
      } else {
        // Création : même format
        if (this.project.tags && this.project.tags.length > 0) {
          projectData.tags = this.project.tags.map(t => ({
            Tags_id: t.Tags_id.id
          }));
        } else {
          projectData.tags = [];
        }
      }

      // Pour la création, ajouter user_created si on a l'ID de l'utilisateur
      if (!this.project.id && this.currentUserId) {
        projectData.user_created = this.currentUserId;
      }
      
      console.log('Saving project data:', projectData);
      
      // Sauvegarder le projet (l'interceptor ajoutera automatiquement le token)
      if (this.project.id) {
        // Mise à jour
        console.log('Updating project:', this.project.id);
        const response = await this.api.updateProject(this.project.id, projectData).toPromise();
        console.log('Update response:', response);
      } else {
        // Création
        console.log('Creating new project');
        const response = await this.api.createProject(projectData).toPromise();
        console.log('Create response:', response);
        this.project.id = response?.data?.id;
      }

      // Rediriger vers le profil
      this.router.navigate(['/profile']);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      this.errorMessage = 'Erreur lors de la sauvegarde du projet';
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  deleteProject(): void {
    if (!this.project.id) return;

    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      const token = this.auth.accessToken;
      if (!token) return;

      this.api.deleteProjects(this.project.id, token).subscribe({
        next: () => {
          this.router.navigate(['/profile']);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression:', error);
          this.errorMessage = 'Erreur lors de la suppression du projet';
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/profile']);
  }

  toggleTag(tag: Tag): void {
    if (!this.project.tags) {
      this.project.tags = [];
    }

    const isSelected = this.isTagSelected(tag.id);

    if (isSelected) {
      // Retirer le tag
      this.project.tags = this.project.tags.filter(t => t.Tags_id.id !== tag.id);
    } else {
      // Ajouter le tag si limite pas atteinte (max 6 tags)
      if (this.project.tags.length < 6) {
        this.project.tags.push({
          Tags_id: {
            id: tag.id,
            name: tag.name
          }
        });
      }
    }

    // Mettre à jour l'affichage des tags filtrés
    this.updateFilteredTags();
    this.cdr.detectChanges();
  }

  toggleTagAndReset(tag: Tag): void {
    this.toggleTag(tag);
    
    // Réinitialiser la recherche après avoir ajouté/retiré un tag
    this.tagSearchQuery = '';
    // Mettre à jour l'affichage (tags sélectionnés + 6 autres)
    this.updateFilteredTags();
    this.cdr.detectChanges();
  }

  isTagSelected(tagId: string): boolean {
    return this.project.tags?.some(t => t.Tags_id.id === tagId) || false;
  }

  filterTags(): void {
    const query = this.tagSearchQuery.trim().toLowerCase();
    
    if (!query) {
      // Si pas de recherche, afficher tags sélectionnés + 6 autres
      this.updateFilteredTags();
    } else {
      // Si recherche active, filtrer parmi tous les tags
      this.filteredTags = this.allTags.filter(tag => 
        tag.name.toLowerCase().includes(query)
      );
    }
    
    this.cdr.detectChanges();
  }

  getFilteredTags(): Tag[] {
    return this.filteredTags.length > 0 || !this.tagSearchQuery.trim() 
      ? this.filteredTags 
      : this.allTags;
  }

  showCreateTagButton(): boolean {
    const query = this.tagSearchQuery.trim();
    if (!query || query.length < 2) return false;
    
    // Vérifier si le tag existe déjà (insensible à la casse)
    const tagExists = this.allTags.some(tag => 
      tag.name.toLowerCase() === query.toLowerCase()
    );
    
    return !tagExists;
  }

  handleTagEnter(): void {
    const query = this.tagSearchQuery.trim();
    if (!query) return;

    // Si c'est un tag existant dans les résultats filtrés, l'ajouter/retirer
    const exactMatch = this.filteredTags.find(tag => 
      tag.name.toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      this.toggleTagAndReset(exactMatch);
      return;
    }

    // Si aucun tag ne correspond, créer un nouveau tag
    if (this.showCreateTagButton()) {
      this.createAndAddTag();
    }
  }

  async createAndAddTag(): Promise<void> {
    const tagName = this.tagSearchQuery.trim();
    if (!tagName || tagName.length < 2) return;
    
    if (this.project.tags && this.project.tags.length >= 10) return;

    try {
      const token = this.auth.accessToken;
      if (!token) {
        this.errorMessage = 'Non authentifié';
        return;
      }

      // Créer le tag dans la base de données
      const response = await this.tagService.createTag({ name: tagName }, token).toPromise();
      
      if (response?.data) {
        const newTag = response.data;
        
        // Ajouter le nouveau tag à la liste complète
        this.allTags.push(newTag);
        
        // Ajouter le tag au projet
        if (!this.project.tags) {
          this.project.tags = [];
        }
        
        this.project.tags.push({
          Tags_id: {
            id: newTag.id,
            name: newTag.name
          }
        });
        
        // Réinitialiser la recherche
        this.tagSearchQuery = '';
        this.filterTags();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Erreur lors de la création du tag:', error);
      this.errorMessage = 'Impossible de créer le tag';
      this.cdr.detectChanges();
    }
  }
}
