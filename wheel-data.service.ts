import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { WheelItem } from './src/models/wheel-item.model';
import { Player } from './src/models/player.model';

@Injectable({
  providedIn: 'root',
})
export class WheelDataService {
  private http = inject(HttpClient);
  
  // ВАЖНО: Замените этот URL на ваш реальный API эндпоинт
  public readonly apiUrl = '/api/players';

  private testItems: WheelItem[] = [
    { id: 'test1', nickname: 'TestUser1', avatarUrl: 'https://picsum.photos/seed/test1/56/56', probability: 0 },
    { id: 'test2', nickname: 'MockPlayer', avatarUrl: 'https://picsum.photos/seed/test2/56/56', probability: 0 },
    { id: 'test3', nickname: 'StaticCat', avatarUrl: 'https://picsum.photos/seed/test3/56/56', probability: 0 },
    { id: 'test4', nickname: 'DataDog', avatarUrl: 'https://picsum.photos/seed/test4/56/56', probability: 0 },
    { id: 'test5', nickname: 'DevOne', avatarUrl: 'https://picsum.photos/seed/test5/56/56', probability: 0 },
    { id: 'test6', nickname: 'TestUser2', avatarUrl: 'https://picsum.photos/seed/test6/56/56', probability: 0 },
    { id: 'test7', nickname: 'FinalMock', avatarUrl: 'https://picsum.photos/seed/test7/56/56', probability: 0 },
  ];

  getWheelItems(source: 'api' | 'test' = 'api'): Observable<WheelItem[]> {
    if (source === 'test') {
      const normalizedTestItems = [...this.testItems];
      const totalItems = normalizedTestItems.length;
      if (totalItems > 0) {
        normalizedTestItems.forEach(item => item.probability = 1 / totalItems);
      }
      return of(normalizedTestItems);
    }

    return this.http.get<Player[]>(this.apiUrl).pipe(
      map(players => {
        // Как было запрошено: используем элементы с индекса 3 по 9 (места с 4 по 10)
        const wheelPlayers = players.slice(3, 10);

        // Преобразуем "сырые" данные игрока в структуру WheelItem, используемую компонентом
        const items: WheelItem[] = wheelPlayers.map(player => ({
          id: String(player.id), // Конвертируем ID в строку для совместимости
          nickname: player.nickname,
          avatarUrl: player.avatar_url, // Маппим snake_case в camelCase
          probability: 1, // Присваиваем равную базовую вероятность
        }));

        // Нормализуем вероятности, чтобы их сумма была равна 1
        const totalProbability = items.length;
        if (totalProbability > 0) {
            items.forEach(item => item.probability /= totalProbability);
        }

        return items;
      })
    );
  }
}