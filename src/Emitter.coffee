{CompositeDisposable, Disposable} = require "event-kit"
EventEmitter3 = require "eventemitter3"

module.exports =
class Emitter extends EventEmitter3
    eventObservers : null
    disposed : false

    constructor : ->
        super
        @eventObservers = new CompositeDisposable

    dispose : ->
        @eventObservers.dispose()

        @_events = null
        @eventObservers = null
        @disposed = true
        return

    ###*
    # @param {String} event     listening event name
    # @param {Function} fn      listener
    # @param {Object?} context  binding context to listener
    ###
    on : (event, fn, context = @) ->
        if @disposed
            throw new Error("Emitter has been disposed")

        super

        disposer = new Disposable => @off(event, fn, context, false)
        @eventObservers.add disposer
        disposer

    ###*
    # @param {String} event     listening event name
    # @param {Function} fn      listener
    # @param {Object?} context  binding context to listener
    ###
    once : (event, fn, context = @) ->
        if @disposed
            throw new Error("Emitter has been disposed")

        super

        disposer = new Disposable => @off(event, fn, context, true)
        @eventObservers.add disposer
        disposer


    ###*
    # @param {String} event     unlistening event name
    # @param {Function?} fn      unlistening listener
    # @param {Object?} context  binded context to listener
    # @param {Boolean?} once    unlistening once listener
    ###
    off : (event, fn, context, once) ->
        return if @disposed

        unless fn?
            @removeAllListeners()
            return

        super
        return

    removeAllListeners : (event) ->
        return if @disposed
        super

    @::addListener = @::on
    @::removeListener = @::off
