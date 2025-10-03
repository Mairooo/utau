import { Injectable } from '@angular/core';
import { Api } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService {

  constructor(private api: Api) {}

  getprojects() {
    return this.api.getprojects();
  }

  createProjects(ProjectsData: any, token: string) {
    return this.api.createProjects(ProjectsData, token);
  }

  getProjectsByName(name: string) {
    return this.api.getProjectsByName(name);
  }

  updateProjects(name: string, ProjectsData: any, token: string) {
    return this.api.updateProjects(name, ProjectsData, token);
  }

  deleteProjects(name: string, token: string) {
    return this.api.deleteProjects(name, token);
  }

  getProjectsByTitle(title: string, token: string) {
  return this.api.getProjectsByTitle(title, token);
}

updateProjectsById(id: string, data: any, token: string) {
  return this.api.updateProjectsById(id, data, token);
}

getNotesByProjects(id: string) {
  return this.api.getNotesByProjects(id);
}

addNote(note: any, token: string) {
  return this.api.addNote(note, token);
}

updateNote(id: string, data: any, token: string) {
  return this.api.updateNote(id, data, token);
}

deleteNote(id: string, token: string) {
  return this.api.deleteNote(id, token);
}

getAllPhonemes() {
  return this.api.getAllPhonemes();
}

getPhonemesByIds(ids: string[]) {
  return this.api.getPhonemesByIds(ids);
}

}