import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsoleService, LogEntry } from '../../services/console.service';

@Component({
  selector: 'app-console',
  imports: [CommonModule],
  templateUrl: './console.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleComponent {
  consoleService = inject(ConsoleService);
  logs = this.consoleService.logs;

  getLogClass(type: LogEntry['type']): string {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  }
}