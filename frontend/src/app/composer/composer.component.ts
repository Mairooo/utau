import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-composer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './composer.component.html',
  styleUrls: ['./composer.component.css']
})
export class ComposerComponent implements OnInit {
  readonly projectTitle = signal('Nouvelle Composition');
  readonly bpm = signal(120);
  readonly isPlaying = signal(false);
  readonly timePosition = signal(0);
  readonly measures = signal(8);
  readonly notesCount = signal(0);

  private playTimer: any = null;

  ngOnInit(): void {}

  onTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) this.projectTitle.set(input.value);
  }

  onTogglePlay(): void {
    const next = !this.isPlaying();
    this.isPlaying.set(next);
    if (next) this.startTicker(); else this.stopTicker();
  }

  onStop(): void {
    this.isPlaying.set(false);
    this.stopTicker();
    this.timePosition.set(0);
  }

  onInitPosition(): void {
    this.timePosition.set(0);
  }

  onChangeBpm(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const val = Number(input?.value ?? '');
    if (!Number.isNaN(val)) this.bpm.set(val);
  }

  private startTicker(): void {
    this.stopTicker();
    const intervalMs = 60000 / Math.max(1, this.bpm());
    this.playTimer = setInterval(() => {
      this.timePosition.update((t) => parseFloat((t + 0.1).toFixed(2)));
    }, intervalMs / 4);
  }

  private stopTicker(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }
}


