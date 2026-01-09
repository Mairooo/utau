import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/auth/login.component';
import { RegisterComponent } from './pages/auth/register.component';
import { OAuthCallbackComponent } from './pages/auth/oauth-callback.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ComposerComponent } from './pages/composer/composer.component';
import { SearchResultsComponent } from './pages/search-results/search-results.component';
import { ProjectDetailComponent } from './pages/project-detail/project-detail.component';
import { ProjectEditComponent } from './pages/project-edit/project-edit.component';
import { authGuard } from './shared/guards/auth.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'auth/callback', component: OAuthCallbackComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'composer', component: ComposerComponent, canActivate: [authGuard] },
  { path: 'project/edit/:id', component: ProjectEditComponent, canActivate: [authGuard] },
  { path: 'search', component: SearchResultsComponent },
  { path: 'project/:title', component: ProjectDetailComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
