NicoUser = require "./NicoUser"

module.exports =
class NicoUserAPI
    constructor : (@_session) ->
        @_cache = {}

    ###*
    # @param {Number} userId
    # @return {Promise}
    ###
    getUserInfo : (userId) ->
        return Promise.resolve(@_cache[userId]) if @_cache[userId]? 
        NicoUser.instance userId, @_session
