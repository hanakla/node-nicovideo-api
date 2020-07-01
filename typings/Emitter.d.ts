/// <reference types="eventemitter3" />
/// <reference types="event-kit" />
import { Disposable } from 'event-kit';
import * as EventEmitter3 from 'eventemitter3';
export default class Emitter extends EventEmitter3 {
    private _eventObservers;
    private _events;
    disposed: boolean;
    dispose(): void;
    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    on(event: string, fn: Function, context?: any): Disposable;
    /**
     * @param {String} event     listening event name
     * @param {Function} fn      listener
     * @param {Object?} context  binding context to listener
     */
    once(event: string, fn: Function, context?: any): Disposable;
    /**
     * @param {String} event     unlistening event name
     * @param {Function?} fn      unlistening listener
     * @param {Object?} context  binded context to listener
     * @param {Boolean?} once    unlistening once listener
     */
    off(event: string, fn?: Function, context?: any, once?: boolean): void;
    removeAllListeners(event?: string): void;
}
