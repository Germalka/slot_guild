import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  timestamp: Date;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConsoleService {
  logs = signal<LogEntry[]>([]);
  private isInitialized = false;
  private logIdCounter = 0;

  init(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    const originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
    };

    const intercept = (type: LogEntry['type'], ...args: any[]) => {
      const message = args.map(arg => {
        try {
          if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        } catch (e) {
          return '<<Unserializable Object>>';
        }
      }).join(' ');

      // Defer the update to the next event cycle to break the infinite change detection loop.
      setTimeout(() => {
        const newLog: LogEntry = {
          id: `${Date.now()}-${this.logIdCounter++}`,
          type,
          timestamp: new Date(),
          message,
        };
        this.logs.update(currentLogs => [
          ...currentLogs,
          newLog,
        ]);
      }, 0);


      originalConsole[type](...args);
    };

    console.log = (...args) => intercept('log', ...args);
    console.warn = (...args) => intercept('warn', ...args);
    console.error = (...args) => intercept('error', ...args);
    console.info = (...args) => intercept('info', ...args);
  }
  
  clear(): void {
    this.logs.set([]);
  }
}