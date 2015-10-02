Request = require "request-promise"

NicoURL = require "./NicoURL"

get = (options) ->
    options.resolveWithFullResponse = true
    Request.get(options)

post = (options) ->
    options.resolveWithFullResponse = true
    Request.post(options)

module.exports =
    nsen :
        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId     LiveID
        # @param {String} options.movieId    Request movie ID
        # @return {Promise}
        ###
        request : (session, {liveId, movieId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST
                jar : session.cookie
                form :
                    v : liveId
                    id : movieId

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        cancelRequest : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST
                jar : session.cookie
                form :
                    v : liveId
                    mode : "cancel"

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        syncRequest : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST
                jar : session.cookie
                form :
                    v : liveId
                    mode : "requesting"

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        sendGood : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_GOOD
                jar : session.cookie
                form :
                    v : liveId

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        sendSkip : (session, {liveId}) ->
            get
                url : NicoUrl.Live.NSEN_SKIP
                jar : session.cookie
                form :
                    v: liveId
