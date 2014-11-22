_   = require "lodash"

wrapper = ->
    throw new Error("Object is already disposed.");

module.exports.wrapAllMembers = (obj, without = null) ->
    props = {}
    without = if without isnt null and  not _.isArray(without) then [without] else []
    len = without.length

    for key of obj
        if len isnt 0 and without.indexOf(key) isnt -1
            continue

        if typeof obj[key] is "function"
            obj[key] = wrapper
        else
            delete obj[key]

            props[key] =
                configurable    : false
                enumerable      : false
                get             : wrapper
                set             : wrapper

    if not _.isEmpty(props)
        Object.defineProperties obj, props

    return
