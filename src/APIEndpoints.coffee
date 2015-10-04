Request = require "request-promise"

NicoURL = require "./NicoURL"

get = (options) ->
    options.resolveWithFullResponse = true
    Request.get(options)

post = (options) ->
    options.resolveWithFullResponse = true
    Request.post(options)

module.exports =
    video :
        ###*
        # @param {NicoSession} session
        # @param {String} options.movieId
        # @return {Promise}
        ###
        getMovieInfo : (session, {movieId}) ->
            get
                url : NicoURL.Video.GET_VIDEO_INFO + movieId
                jar : session.cookie

    live :
        ###*
        # @param {NicoSession}
        # @param {String} options.liveId
        ###
        getPlayerStatus : (session, {liveId}) ->
            get
                url : NicoURL.Live.GET_PLAYER_STATUS + liveId
                jar : session.cookie

    nsen :
        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId     LiveID
        # @param {String} options.movieId    Request movie ID
        # @return {Promise}
        ###
        request : (session, {liveId, movieId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST+"?v=#{liveId}&id=#{movieId}"
                jar : session.cookie
                # form :
                #     v : liveId
                #     id : movieId

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        cancelRequest : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST + "?v=#{liveId}&mode=cancel"
                jar : session.cookie
                # form :
                #     v : liveId
                #     mode : "cancel"

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        syncRequest : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_REQUEST + "?v=#{liveId}&mode=requesting"
                jar : session.cookie
                # form :
                #     v : liveId
                #     mode : "requesting"

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        sendGood : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_GOOD + "?v=#{liveId}"
                jar : session.cookie
                # form :
                #     v : liveId

        ###*
        # @param {NicoSession} session
        # @param {String} options.liveId LiveID
        # @return Promise
        ###
        sendSkip : (session, {liveId}) ->
            get
                url : NicoURL.Live.NSEN_SKIP + "?v=#{liveId}"
                jar : session.cookie
                # form :
                #     v: liveId

    user :
        info : (session, {userId}) ->
            get
                url : NicoURL.User.INFO + "?__format=json&user_id=#{userId}"
                jar : session.cookie
