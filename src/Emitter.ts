import { CompositeDisposable, Disposable } from "event-kit";

interface EventSet {
  [eventName: string]: any;
}

interface ListenerEntry {
  listener: (...args: any[]) => void;
  disposer: Disposable;
  once: boolean;
}

export type ListenerOf<T extends any[]> = (...args: T[]) => void;

export default class Emitter<T extends EventSet> {
  private _eventObservers: CompositeDisposable | null = new CompositeDisposable();
  private events: { [eventName: string]: ListenerEntry[] } = Object.create(
    null
  );
  private autoEmits: { [eventName: string]: any[] } = Object.create(null);
  public disposed: boolean;

  public dispose() {
    this._eventObservers!.dispose();
    this.events = null as any;
    this._eventObservers = null;
    this.disposed = true;
  }

  public on<K extends keyof T>(
    event: K,
    listener: ListenerOf<T[K]>,
    once: boolean = false
  ): Disposable {
    const e = event as string;

    if (this.disposed) {
      throw new Error("Emitter has been disposed");
    }

    const sets = (this.events[e] = this.events[e] || []);

    const disposer = new Disposable(() => this.off(event, listener, once));

    sets.push({ listener, once, disposer });
    this._eventObservers!.add(disposer);

    if (this.autoEmits[e]) {
      listener(...this.autoEmits[e]);
    }

    return disposer;
  }

  public once<K extends keyof T>(event: K, listener: ListenerOf<T[K]>) {
    return this.on(event, listener, true);
  }

  public off<K extends keyof T>(
    event: K,
    fn?: ListenerOf<T[K]>,
    once: boolean = false
  ) {
    const _e = event as string;

    if (this.disposed) return;
    if (!this.events[_e]) return;

    if (fn == null) {
      this.removeAllListeners();
    }

    const newListeners = this.events[_e].filter(
      (entry) => entry.listener !== fn && entry.once !== once
    );

    this.events[_e] = newListeners;
  }

  public emit<K extends keyof T>(event: K, ...args: T[K]) {
    const e = event as string;
    if (!this.events[e]) return;
    this.events[e].forEach((entry) => entry.listener(...args));
  }

  public lockAutoEmit<K extends keyof T>(event: K, ...args: T[K]) {
    const e = event as string;
    if (this.autoEmits[e]) return;

    this.autoEmits[e] = args;
  }

  public stopAutoEmit<K extends keyof T>(event: K) {
    delete this.autoEmits[event as string];
  }

  public removeAllListeners(event?: string) {
    if (this.disposed) return;
    this.events = {};
    this._eventObservers = new CompositeDisposable();
  }
}
