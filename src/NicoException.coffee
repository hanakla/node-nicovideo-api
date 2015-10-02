module.exports =
class NicoException extends Error
    constructor : (@message, @code) ->
        super(@message)
