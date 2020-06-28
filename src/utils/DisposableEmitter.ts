import { CompositeDisposable, Disposable } from "event-kit-browserify";

interface EventSet {
  [eventName: string]: any;
}

interface ListenerEntry {
  listener: (...args: any) => void;
  context: DisposableEmitter<any>;
  once: boolean;
  disposer: Disposable | null;
}

export type ListenerOf<T extends any[]> = (...args: T) => void;

export class DisposableEmitter<T extends EventSet> {
  public disposed: boolean = false;

  private _events: Record<string, ListenerEntry[]> = Object.create(null);
  private _autoEmitEvents = Object.create(null);
  private _eventDisposers = new CompositeDisposable();

  constructor() {
    this._events = Object.create(null);
    this._eventDisposers = new CompositeDisposable();
  }

  public on<E extends keyof T>(
    event: E,
    fn: (...args: T[E]) => void,
    context: DisposableEmitter<any> = this,
    once: boolean = false
  ): Disposable {
    if (context == null) {
      context = this;
    }

    if (this.disposed) {
      throw new Error("Emitter has been disposed");
    }

    const type = typeof fn;
    if (type !== "function") {
      throw new TypeError(`Listener must be function(${type} given).`);
    }

    if (this._autoEmitEvents[event] != null) {
      fn.apply(context, this._autoEmitEvents[event].args);
    }

    const listener = {
      listener: fn,
      context: context != null ? context : this,
      once,
      disposer: null,
    };

    (this._events[event as string] != null
      ? this._events[event as string]
      : (this._events[event as string] = [])
    ).push(listener);

    const disposer = new Disposable(() => this.off(event, fn));
    this._eventDisposers.add(disposer);
    listener.disposer = disposer;

    return disposer;
  }

  public once<E extends keyof T>(
    event: E,
    fn: ListenerOf<T[E]>,
    context = this
  ): Disposable {
    return this.on(event, fn, context, true);
  }

  /**
   * @return {DisposableEmitter}
   */
  public off<E extends keyof T>(
    event: E,
    fn: ListenerOf<T[E]>,
    context: DisposableEmitter<any> = this,
    once = false
  ) {
    if (this.disposed) {
      return this;
    }

    const listeners = this._events[event as string];
    if (listeners == null || listeners.length === 0) {
      return this;
    }

    const newListeners = [];
    for (let entry of listeners) {
      if (
        entry.listener !== fn ||
        (once != null && entry.once !== once) ||
        (context != null && entry.context !== context)
      ) {
        newListeners.push(entry);
      }
    }

    this._events[event as string] = newListeners;
    return this;
  }

  /**
   * @return {DisposableEmitter}
   */
  public removeAllListeners(event: keyof T) {
    if (this.disposed) {
      return this;
    }

    const disposers = this._eventDisposers;

    if (event != null) {
      const listeners = this._events[event as string];
      if (listeners == null || listeners.length === 0) {
        return this;
      }

      for (let entry of Array.from(listeners)) {
        disposers.remove(entry.disposer);
      }

      this._events[event as string] = [];
    } else {
      disposers.clear();
      this._events = Object.create(null);
    }

    return this;
  }

  public emit<E extends keyof T>(event: E, ...args: T[E]) {
    if (this.disposed) {
      throw new Error("Emitter has been disposed");
    }

    const listeners = this._events[event as string];
    if (listeners == null || listeners.length === 0) {
      return this;
    }

    for (let entry of Array.from(listeners)) {
      if (entry.once) {
        this.off(event, entry.listener, entry.context, true);
      }

      entry.listener.apply(entry.context, args);
    }

    return this;
  }

  public startAutoEmit<E extends keyof T>(event: E, ...args: T[E]) {
    if (this.disposed) {
      throw new Error("Emitter has been disposed");
    }

    if (this._autoEmitEvents[event] != null) {
      return false;
    }

    this._autoEmitEvents[event] = { args };
    this.emit(event, ...args);
  }

  public stopAutoEmit(event: keyof T) {
    if (this.disposed) {
      return;
    }

    if (this._autoEmitEvents[event] == null) {
      return false;
    }

    delete this._autoEmitEvents[event];
  }

  public isAutoEmitting(event: keyof T) {
    return this._autoEmitEvents[event] != null;
  }

  public dispose() {
    if (this.disposed) {
      return true;
    }

    this._events = {};
    this._autoEmitEvents = null;
    this._eventDisposers = null;
    this.disposed = true;

    return this.disposed;
  }
}
