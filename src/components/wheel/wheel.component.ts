import { Component, ChangeDetectionStrategy, input, computed, signal, ElementRef, viewChild, AfterViewInit, output } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { WheelItem } from '../../models/wheel-item.model';

@Component({
  selector: 'app-wheel',
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './wheel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WheelComponent implements AfterViewInit {
  items = input.required<WheelItem[]>();
  reel = viewChild.required<ElementRef<HTMLDivElement>>('reel');
  viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  onSpinComplete = output<WheelItem>();

  isSpinning = signal(false);
  reelTransform = signal('translateY(0px)');
  selectedItem = signal<WheelItem | null>(null);
  resultVisible = signal(false);
  winningIndex = signal<number | null>(null);
  spinDurationMs = signal(3000);
  activeLightIndex = signal<number | null>(null);

  // Signals to dynamically control transition properties
  transitionDuration = signal('0ms');
  transitionTimingFunction = signal('ease-out');

  private itemHeightPx = signal(128);
  private viewportHeightPx = signal(128);
  private readonly REVOLUTIONS = 5;
  private lastWinnerIndex = 0;
  private lightIntervalId: number | null = null;
  private spinTimeoutId: number | null = null;
  private bounceTimeoutId: number | null = null;

  readonly reelItems = computed(() => {
    const baseItems = this.items();
    if (baseItems.length === 0) return [];
    // Repeat items to ensure smooth visual looping. 15 repetitions is plenty.
    return Array(15).fill(baseItems).flat();
  });

  ngAfterViewInit(): void {
    // Use a small timeout to ensure rendering is complete before measuring.
    setTimeout(() => {
        const reelEl = this.reel().nativeElement;
        const viewportEl = this.viewport().nativeElement;
        if (reelEl && reelEl.firstElementChild) {
            this.itemHeightPx.set((reelEl.firstElementChild as HTMLElement).offsetHeight);
        }
        if (viewportEl) {
            this.viewportHeightPx.set(viewportEl.clientHeight);
        }
    }, 0);
  }

  onSpeedChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.spinDurationMs.set(Number(input.value));
  }

  spin(): void {
    if (this.isSpinning() || this.items().length === 0) {
      return;
    }

    // Clear any lingering timers from a previous, possibly interrupted spin
    if (this.lightIntervalId) clearInterval(this.lightIntervalId);
    if (this.spinTimeoutId) clearTimeout(this.spinTimeoutId);
    if (this.bounceTimeoutId) clearTimeout(this.bounceTimeoutId);

    this.isSpinning.set(true);
    this.selectedItem.set(null);
    this.resultVisible.set(false);
    this.winningIndex.set(null);
    this.activeLightIndex.set(null);
    
    const winner = this.determineWinner();
    const winnerIndexOriginal = this.items().findIndex(item => item.id === winner.id);
    const { startY, finalY, targetIndexInStrip } = this.calculateTargetPosition(winnerIndexOriginal);

    // 1. Instantly reset to the calculated starting position
    this.transitionDuration.set('0ms');
    this.reelTransform.set(`translateY(-${startY}px)`);
    
    // 2. Use rAF to apply reset before starting the spin animation
    requestAnimationFrame(() => {
      const mainSpinDuration = this.spinDurationMs();
      const bounceDuration = 500;

      // Phase 1: Linear spin that overshoots the target by 60px
      this.transitionDuration.set(`${mainSpinDuration}ms`);
      this.transitionTimingFunction.set('linear');
      this.reelTransform.set(`translateY(-${finalY - 60}px)`);

      const lightStepInterval = (mainSpinDuration / this.REVOLUTIONS) / 3; // 3 lights
      this.lightIntervalId = window.setInterval(() => {
        this.activeLightIndex.update(current => (current === null || current >= 2) ? 0 : current + 1);
      }, lightStepInterval);

      // Phase 2: After the linear spin, bounce back to the final position
      this.bounceTimeoutId = window.setTimeout(() => {
        if (this.lightIntervalId) clearInterval(this.lightIntervalId);
        this.activeLightIndex.set(null);
        
        this.transitionDuration.set(`${bounceDuration}ms`);
        this.transitionTimingFunction.set('cubic-bezier(0.34, 1.56, 0.64, 1)');
        this.reelTransform.set(`translateY(-${finalY}px)`);
      }, mainSpinDuration);

      // Phase 3: After the bounce completes, finalize the state
      this.spinTimeoutId = window.setTimeout(() => {
        this.isSpinning.set(false);
        this.selectedItem.set(winner);
        this.onSpinComplete.emit(winner); // Notify parent component about the winner
        this.resultVisible.set(true);
        this.winningIndex.set(targetIndexInStrip); // This triggers highlight and flip
        this.lastWinnerIndex = winnerIndexOriginal;
      }, mainSpinDuration + bounceDuration);
    });
  }
  
  public getBoxShadow(index: number): string {
    const winnerIdx = this.winningIndex();
    // Base shadow for the "inset frame" effect on all items.
    const baseShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.06)';

    if (this.isSpinning() || winnerIdx === null) {
      return baseShadow;
    }
    
    // Winner's multiple shadows: base + golden border + golden glow
    if (index === winnerIdx) {
      const winnerGlow = 'inset 0 0 25px rgba(252, 211, 77, 0.4)';
      const winnerBorder = 'inset 0 0 0 2px rgba(252, 211, 77, 0.7)';
      return `${baseShadow}, ${winnerBorder}, ${winnerGlow}`;
    }
    
    // The old 2D curve effect via shadow is now replaced by a real 3D transform.
    return baseShadow;
  }
  
  public getItemTransform(index: number): string {
    const winnerIdx = this.winningIndex();

    if (this.isSpinning() || winnerIdx === null) {
      return 'none';
    }

    // Item above the winner - curves "into" the screen
    if (index === winnerIdx - 1) {
      return 'rotateX(-15deg)';
    }

    // Item below the winner - curves "into" the screen
    if (index === winnerIdx + 1) {
      return 'rotateX(15deg)';
    }

    return 'none';
  }

  private calculateTargetPosition(winnerIndex: number): { startY: number; finalY: number; targetIndexInStrip: number; } {
    const baseItemsCount = this.items().length;
    if (baseItemsCount === 0) return { startY: 0, finalY: 0, targetIndexInStrip: 0 };
    
    const itemHeight = this.itemHeightPx();
    const viewportHeight = this.viewportHeightPx();

    // Start from a higher repetition and move to a lower one to spin "down"
    const startRepetition = 10; 
    const passes = this.REVOLUTIONS;
    const targetRepetition = startRepetition - passes;
    const viewportCenter = viewportHeight / 2;

    const startIndexInStrip = (startRepetition * baseItemsCount) + this.lastWinnerIndex;
    const startItemCenter = (startIndexInStrip * itemHeight) + (itemHeight / 2);
    const startY = startItemCenter - viewportCenter;

    const targetIndexInStrip = (targetRepetition * baseItemsCount) + winnerIndex;
    const finalItemCenter = (targetIndexInStrip * itemHeight) + (itemHeight / 2);
    const finalY = finalItemCenter - viewportCenter;
    
    return { startY, finalY, targetIndexInStrip };
  }

  private determineWinner(): WheelItem {
    const random = Math.random();
    let cumulativeProbability = 0;
    for (const item of this.items()) {
      cumulativeProbability += item.probability;
      if (random < cumulativeProbability) return item;
    }
    return this.items()[this.items().length - 1];
  }
}
