let Emitter;
const {CompositeDisposable, Disposable} = require("event-kit");
const EventEmitter3 = require("eventemitter3");

module.exports =
(Emitter = (function() {
    Emitter = class Emitter extends EventEmitter3 {
        static initClass() {
            this.prototype._eventObservers  = null;
            this.prototype.disposed  = false;
    
            this.prototype.addListener = this.prototype.on;
            this.prototype.removeListener = this.prototype.off;
        }

        constructor() {
            super(...arguments);
            this._eventObservers = new CompositeDisposable;
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
        on(event, fn, context) {
            if (context == null) { context = this; }
            if (this.disposed) {
                throw new Error("Emitter has been disposed");
            }

            super.on(...arguments);

            const disposer = new Disposable((function() { return this.off(event, fn, context, false); }.bind(this)));
            this._eventObservers.add(disposer);
            return disposer;
        }

        /**
         * @param {String} event     listening event name
         * @param {Function} fn      listener
         * @param {Object?} context  binding context to listener
         */
        once(event, fn, context) {
            if (context == null) { context = this; }
            if (this.disposed) {
                throw new Error("Emitter has been disposed");
            }

            super.once(...arguments);

            const disposer = new Disposable((function() { return this.off(event, fn, context, true); }.bind(this)));
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
    Emitter.initClass();
    return Emitter;
})());
