import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { switchMap, catchError, map, startWith } from 'rxjs';
import { of } from 'rxjs';

import { WheelComponent } from './components/wheel/wheel.component';
import { WheelDataService } from '../wheel-data.service';
import { WheelItem } from './models/wheel-item.model';

// State interface for handling data loading, success, and error states
interface WheelDataState {
  status: 'loading' | 'loaded' | 'error';
  items: WheelItem[];
  error: { message: string, url?: string } | null;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WheelComponent],
})
export class AppComponent {
  private wheelDataService = inject(WheelDataService);
  
  dataSource = signal<'api' | 'test'>('test');
  winnersHistory = signal<WheelItem[]>([]);

  dataState = toSignal(
    toObservable(this.dataSource).pipe(
      switchMap(source => 
        this.wheelDataService.getWheelItems(source).pipe(
          map(items => ({ 
            status: 'loaded', 
            items, 
            error: null 
          } as WheelDataState)),
          catchError(err => {
            console.error('Не удалось загрузить данные:', err);
            const errorMessage = err.message || 'Сервер не отвечает или произошла ошибка сети.';
            return of({ 
              status: 'error', 
              items: [], 
              error: { message: errorMessage, url: this.wheelDataService.apiUrl } 
            } as WheelDataState);
          })
        )
      ),
      startWith({ status: 'loading', items: [], error: null } as WheelDataState)
    ), 
    { initialValue: { status: 'loading', items: [], error: null } as WheelDataState }
  );

  toggleDataSource(): void {
    this.dataSource.update(current => (current === 'api' ? 'test' : 'api'));
  }
  
  addToHistory(winner: WheelItem): void {
    this.winnersHistory.update(currentHistory => {
      const newHistory = [winner, ...currentHistory];
      return newHistory.slice(0, 5); // Keep only the last 5 winners
    });
  }
}
