__ = require "lodash-deep"
deepFreeze = require "deep-freeze"

APIEndpoints = require "../APIEndpoints"
NicoException = require "../NicoException"

module.exports =
class NicoUser
    ###*
    # @return {Promise}
    ###
    @instance : (userId, session) ->
        return if userId is 0
            Promise.resolve(@makeAnonymousUser())

        APIEndpoints.user.info(session, {userId})
        .then (res) =>
            try
                result = JSON.parse res.body
                data = result.nicovideo_user_response
            catch e
                Promise.reject new NicoException
                    message  : "Failed to parse user info response."
                    response : res
                    previous : e

            return if data["@status"] isnt "ok"
                Promise.reject new NicoException
                    message     : data.error.description
                    code        : data.error.code
                    response    : result

            props = deepFreeze @parseResponse(result)
            user = new NicoUser(props)

            Promise.resolve(user)


    ###*
    # @param {Object} res
    ###
    @parseResponse : (res) ->
        data = res.nicovideo_user_response
        user = data.user

        {
            id              : user.id | 0
            name            : user.nickname
            thumbnailURL    : user.thumbnail_url
            additionals     : data.additionals
            vita            :
                userSecret      : data.vita_option.user_secret | 0
        }


    @makeAnonymousUser : ->
        props = deepFreeze
            id              : 0
            name            : ""
            thumbnailURL    : "http://uni.res.nimg.jp/img/user/thumb/blank.jpg"
            additionals     : ""
            vita            :
                userSecret      : 0

        user = new NicoUser(props)


    ###*
    # @param {Object} props
    ###
    constructor : (props) ->
        Object.defineProperties @,
            id :
                value : props.id
            _props :
                value : props


    get : (key) ->
        __.deepGet(@_props, key)
