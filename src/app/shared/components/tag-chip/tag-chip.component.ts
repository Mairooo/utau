import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Tag } from '../../interfaces/tag.interface';

@Component({
  selector: 'app-tag-chip',
  standalone: false,
  templateUrl: './tag-chip.component.html',
  styleUrl: './tag-chip.component.css'
})
export class TagChip {
  @Input() tag!: Tag;
  @Input() removable = false;
  @Input() clickable = false;
  @Input() size: 'small' | 'medium' = 'medium';
  @Output() tagClick = new EventEmitter<Tag>();
  @Output() tagRemove = new EventEmitter<Tag>();

  onClick(): void {
    if (this.clickable) {
      this.tagClick.emit(this.tag);
    }
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.tagRemove.emit(this.tag);
  }

  getSizeClass(): string {
    return this.size === 'small' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1';
  }
}
