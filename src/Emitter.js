import { CompositeDisposable, Disposable } from "event-kit";
import EventEmitter3 from "eventemitter3";

export default class Emitter extends EventEmitter3 {
    _eventObservers  = null;
    disposed  = false;

    constructor() {
        super(...arguments);
        this._eventObservers = new CompositeDisposable();
    }

    dispose() {
        this._eventObservers.dispose();

        this._events = null;
        this._eventObservers = null;
        this.disposed = true;
    }

    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    on(event, fn, context = this) {
        if (this.disposed) {
            throw new Error("Emitter has been disposed");
        }

        super.on(...arguments);

        let disposer = new Disposable(() => this.off(event, fn, context, false));
        this._eventObservers.add(disposer);
        return disposer;
    }

    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    once(event, fn, context = this) {
        if (this.disposed) {
            throw new Error("Emitter has been disposed");
        }

        super.once(...arguments);

        let disposer = new Disposable(() => this.off(event, fn, context, true));
        this._eventObservers.add(disposer);
        return disposer;
    }


    /**
     * @param {String} event     unlistening event name
     * @param {Function?} fn      unlistening listener
     * @param {Object?} context  binded context to listener
     * @param {Boolean?} once    unlistening once listener
     */
    off(event, fn, context, once) {
        if (this.disposed) { return; }

        if (fn == null) {
            this.removeAllListeners();
            return;
        }

        super.off(...arguments);
    }

    removeAllListeners(event) {
        if (this.disposed) { return; }
        return super.removeAllListeners(...arguments);
    }
};

Emitter.prototype.addListener = Emitter.prototype.on;
Emitter.prototype.removeListener = Emitter.prototype.off;
