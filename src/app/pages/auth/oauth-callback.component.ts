import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <p class="mt-4 text-gray-600">Connexion en cours...</p>
      </div>
    </div>
  `
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];
      const error = params['error'];

      if (error) {
        console.error('OAuth error:', error);
        alert('Erreur lors de la connexion: ' + error);
        this.router.navigate(['/login']);
        return;
      }

      if (accessToken && refreshToken) {
        // Stocker les tokens
        localStorage.setItem('directus_access_token', accessToken);
        localStorage.setItem('directus_refresh_token', refreshToken);
                
        // Nettoyer l'URL IMMÉDIATEMENT (enlever les tokens de l'historique)
        window.history.replaceState({}, document.title, '/');
        
        // Rediriger vers la page d'accueil
        this.router.navigate(['/']);
      } else {
        console.error('Tokens manquants dans la réponse OAuth');
        this.router.navigate(['/login']);
      }
    });
  }
}
