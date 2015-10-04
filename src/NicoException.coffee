module.exports =
class NicoException extends Error
    constructor : ({@message, @code, @response, @previous}) ->
        super(@message)
