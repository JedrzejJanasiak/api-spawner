import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressBarOptions {
  title?: string;
  format?: string;
  barCompleteChar?: string;
  barIncompleteChar?: string;
  hideCursor?: boolean;
}

export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private total: number;
  private current: number = 0;

  constructor(total: number, options: ProgressBarOptions = {}) {
    this.total = total;
    
    const defaultFormat = options.title 
      ? `${options.title} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s | {status}`
      : `|${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s | {status}`;

    this.bar = new cliProgress.SingleBar({
      format: options.format || defaultFormat,
      barCompleteChar: options.barCompleteChar || '█',
      barIncompleteChar: options.barIncompleteChar || '░',
      hideCursor: options.hideCursor !== false,
      clearOnComplete: true,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);

    this.bar.start(total, 0, { status: 'Starting...' });
  }

  update(value: number, status?: string): void {
    this.current = value;
    this.bar.update(value, { status: status || 'Processing...' });
  }

  increment(status?: string): void {
    this.current++;
    this.bar.update(this.current, { status: status || 'Processing...' });
  }

  setStatus(status: string): void {
    this.bar.update(this.current, { status });
  }

  stop(): void {
    this.bar.stop();
  }

  complete(status?: string): void {
    this.bar.update(this.total, { status: status || 'Completed!' });
    this.bar.stop();
  }
}

export class MultiProgressBar {
  private multibar: cliProgress.MultiBar;
  private bars: Map<string, cliProgress.SingleBar> = new Map();

  constructor() {
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: `|${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | {status}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
    }, cliProgress.Presets.shades_classic);
  }

  createBar(id: string, total: number, title?: string): cliProgress.SingleBar {
    const format = title 
      ? `${title} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | {status}`
      : `|${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} | {status}`;

    const bar = this.multibar.create(total, 0, { status: 'Starting...' });
    this.bars.set(id, bar);
    return bar;
  }

  updateBar(id: string, value: number, status?: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.update(value, { status: status || 'Processing...' });
    }
  }

  completeBar(id: string, status?: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.update(bar.getTotal(), { status: status || 'Completed!' });
    }
  }

  stop(): void {
    this.multibar.stop();
  }
} 