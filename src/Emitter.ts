import {CompositeDisposable, Disposable} from 'event-kit'
import * as EventEmitter3 from 'eventemitter3'

export default class Emitter extends EventEmitter3
{
    private _eventObservers: CompositeDisposable|null = new CompositeDisposable()
    private _events: {[eventName: string]: Function[]}|null = {}
    public disposed: boolean

    public dispose()
    {
        this._eventObservers!.dispose();
        this._events = null;
        this._eventObservers = null;
        this.disposed = true;
    }

    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    public on(event: string, fn: Function, context?: any): Disposable
    {
        if (this.disposed) {
            throw new Error("Emitter has been disposed")
        }

        super.on(event, fn, context)

        const disposer = new Disposable((function() { return this.off(event, fn, context, false) }.bind(this)))
        this._eventObservers!.add(disposer)
        return disposer
    }

    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    public once(event: string, fn: Function, context?: any)
    {
        if (this.disposed) {
            throw new Error("Emitter has been disposed")
        }

        super.once(event, fn, context)

        const disposer = new Disposable(() => this.off(event, fn, context, true))
        this._eventObservers!.add(disposer)
        return disposer
    }


    /**
     * @param {String} event     unlistening event name
     * @param {Function?} fn      unlistening listener
     * @param {Object?} context  binded context to listener
     * @param {Boolean?} once    unlistening once listener
     */
    public off(event: string, fn?: Function, context?: any, once?: boolean)
    {
        if (this.disposed) return

        if (fn == null) {
            this.removeAllListeners()
        }

        super.off(event, fn, context, once)
    }

    removeAllListeners(event?: string) {
        if (this.disposed) return
        super.removeAllListeners(event)
    }
}