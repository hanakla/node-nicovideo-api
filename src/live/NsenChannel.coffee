###*
# @class NsenChannel
###

_ = require "lodash"
Emitter = require "../Emitter"
Cheerio = require "cheerio"
deepFreeze = require "deep-freeze"
Request = require "request-promise"
{sprintf} = require("sprintf")
{CompositeDisposable} = require "event-kit"
QueryString = require "querystring"

APIEndpoints = require "../APIEndpoints"
NicoException = require "../NicoException"
NicoLiveInfo = require "./NicoLiveInfo"
NsenChannels = require "./NsenChannels"

module.exports =
class NsenChannel extends Emitter

    ###*
    # Nsenリクエスト時のエラーコード
    # @const {Object.<String, String>
    ###
    @RequestError  : deepFreeze
        NO_LOGIN : "not_login"
        CLOSED : "nsen_close"
        REQUIRED_TAG : "nsen_tag"
        TOO_LONG : "nsen_long"
        REQUESTED : "nsen_requested"

    # "ログインしていません。"
    # "現在リクエストを受け付けていません。"
    # "リクエストに必要なタグが登録されていません。"
    # "動画が長過ぎます。"
    # "リクエストされたばかりです。"

    @Gage : deepFreeze
        BLUE : 0
        GREEN : 1
        YELLOW : 2
        ORANGE : 3
        RED : 4


    @Channels       : NsenChannels


    ###*
    # @return Promise
    ###
    @instanceFor : (live, session) ->
        nsen = new NsenChannel(live, session)
        nsen._attachLive(live)
        Promise.resolve nsen



    ###*
    # @private
    # @property {NicoLiveInfo} _live
    ###
    _live           : null

    ###*
    # @private
    # @property {CommentProvider} _commentProvider
    ###
    _commentProvider : null

    ###*
    # @private
    # @property {NicoSession} _session
    ###
    _session         : null

    ###*
    # 再生中の動画情報
    # @private
    # @property {NicoLiveInfo} _playingMovie
    ###
    _playingMovie   : null

    ###*
    # 最後にリクエストした動画情報
    # @private
    # @property {NicoVideoInfo} _requestedMovie
    ###
    _requestedMovie : null

    ###*
    # 最後にスキップした動画のID。
    # 比較用なので動画IDだけ。
    # @private
    # @property {String} _lastSkippedMovieId
    ###
    _lastSkippedMovieId : null

    ###*
    # （午前４時遷移時の）移動先の配信のID
    # @property {String} _nextLiveId
    ###
    _nextLiveId     : null


    ###*
    # @param {NicoLiveInfo} liveInfo
    # @param {NicoSession} _session
    ###
    constructor     : (liveInfo, @_session) ->
        if liveInfo not instanceof NicoLiveInfo
            throw new TypeError "Passed object not instance of NicoLiveInfo."

        if liveInfo.isNsenLive() is false
            throw new TypeError "This live is not Nsen live streaming."

        super

        Object.defineProperties @,
            id  :
                get : -> @getChannelType()

        @onDidChangeMovie @_didChangeMovie
        @onWillClose @_willClose


    ###*
    # @return {Promise}
    ###
    _attachLive : (liveInfo) ->
        @_channelSubscriptions?.dispose()
        @_live = null
        @_commentProvider = null

        @_channelSubscriptions = sub = new CompositeDisposable
        @_live = liveInfo

        sub.add liveInfo.onDidRefresh =>
            @_didLiveInfoUpdated()

        liveInfo.commentProvider({connect: true})
        .then (provider) =>
            @_commentProvider = provider

            # if provider.isFirstResponseProsessed is no
            #     sub.add provider.onDidProcessFirstResponse (comments) =>
            #         comments.forEach (comment) =>
            #             @_didCommentReceived comment, {ignoreVideoChanged: true}
            #
            #         sub.add provider.onDidReceiveComment (comment) =>
            #             @_didCommentReceived(comment)
            #
            # else
            sub.add provider.onDidReceiveComment (comment) =>
                @_didCommentReceived(comment)

            sub.add provider.onDidEndLive => @_onLiveClosed()

            @_didLiveInfoUpdated()
            @fetch()


    ###*
    # チャンネルの種類を取得します。
    # @return {String} "vocaloid", "toho"など
    ###
    getChannelType  : ->
        @_live.get("stream.nsenType")


    ###*
    # 現在接続中の放送のNicoLiveInfoオブジェクトを取得します。
    # @return {NicoLiveInfo}
    ###
    getLiveInfo     : ->
        @_live


    ###*
    # 現在利用しているCommentProviderインスタンスを取得します。
    # @return {CommentProvider?}
    ###
    commentProvider : ->
        @_commentProvider


    ###*
    # 現在再生中の動画情報を取得します。
    # @return {NicoVideoInfo?}
    ###
    getCurrentVideo     : ->
        return @_playingMovie


    ###*
    # @return {NicoVideoInfo?}
    ###
    getRequestedMovie : ->
        @_requestedMovie


    ###*
    # スキップリクエストを送信可能か確認します。
    # 基本的には、sendSkipイベント、skipAvailableイベントで
    # 状態の変更を確認するようにします。
    # @return {boolean
    ###
    isSkipRequestable   : ->
        video = @getCurrentVideo()
        return (video isnt null) and (@_lastSkippedMovieId isnt video.id)


    ###*
    # @private
    # @param {String} command NicoLive command with "/" prefix
    # @param {Array.<String>} params command params
    ###
    _processLiveCommands : (command, params = [], options = {}) ->
        switch command
            when "/prepare"
                [videoId] = params
                @_willMovieChange videoId

            when "/play"
                break if options.ignoreVideoChanged

                [source, view, title] = params
                videoId = /smile:((?:sm|nm)[1-9][0-9]*)/.exec(source)

                if videoId?[1]?
                    @_didDetectMovieChange videoId[1]
                    # @emit "did-change-movie", videoId[1]

            when "/reset"
                [nextLiveId] = params
                @_nextLiveId = nextLiveId
                @emit "will-close", nextLiveId

            when "/nspanel"
                [operation, entity] = params
                @_processNspanelCommand(operation, entity)

            when "/nsenrequest"
                [state] = params # "on", "lot"
                @emit "did-receive-request-state", state


    ###*
    # Processing /nspanel command
    # @private
    # @param {String} op
    # @param {String} entity
    ###
    _processNspanelCommand : (op, entity) ->
        return if op isnt "show"

        panelState = QueryString.parse(entity)

        switch true
            when panelState.goodClick?
                @emit "did-receive-good"
                return

            when panelState.mylistClick?
                @emit "did-receive-add-mylist"
                return

        if panelState.dj?
            @emit "did-receive-tvchan-message", panelState.dj
            return

        @emit "did-change-panel-state", {
            goodBtn     : panelState.goodBtn is "1"
            mylistBtn   : panelState.mylistBtn is "1"
            skipBtn     : panelState.skipBtn is "1"
            title       : panelState.title
            view        : panelState.view | 0
            comment     : panelState.comment | 0
            mylist      : panelState.mylist | 0
            uploadDate  : new Date(panelState.date)
            playlistLen : panelState.playlistLen | 0
            corner      : panelState.corner isnt "0"
            gage        : panelState.gage | 0
            tv          : panelState.tv | 0
        }

        return


    ###*
    # サーバー側の情報とインスタンスの情報を同期します。
    # @return {Promise}
    ###
    fetch               : ->
        return unless @_live?
            Promise.reject new NicoException
                message: "LiveInfo not attached."

        # リクエストした動画の情報を取得
        liveId = @_live.get("stream").liveId

        @_live.fetch()

        .then =>
            APIEndpoints.nsen.syncRequest(@_session, {liveId})

        .catch (e) =>
            Promise.reject new NicoException
                message     : "Failed to fetch Nsen request status. (#{e.message})"
                previous    : e

        .then (res) =>
            $res = Cheerio.load(res.body)(":root")

            status = $res.attr("status")
            errorCode = $res.find("error code").text()

            return if status isnt "ok" and errorCode isnt "unknown"
                Promise.reject new NicoException
                    message     : "Failed to fetch Nsen request status. (#{errorCode})"
                    code        : errorCode
                    response    : res.body

            return if errorCode is "unknown" and @_requestedMovie?
                @_requestedMovie = null
                @emit "did-cancel-request"
                Promise.resolve()

            # リクエストの取得に成功したら動画情報を同期
            videoId = $res.find("id").text()

            # 直前にリクエストした動画と内容が異なれば
            # 新しい動画に更新
            if not @_requestedMovie? or @_requestedMovie.id isnt videoId
                @_session.video.getVideoInfo(videoId)

        .then (movie) =>
            return unless movie?

            @_requestedMovie = movie
            @emit "did-send-request", movie
            Promise.resolve()


    ###*
    # コメントサーバーに再接続します。
    ###
    reconnect : ->
        @_commentProvider.reconnect()


    dispose         : ->
        @emit "will-dispose"
        @_live = null
        @_commentProvider = null
        @_channelSubscriptions.dispose()
        super



    #
    # Nsen control methods
    #

    ###*
    # リクエストを送信します。
    # @param {NicoVideoInfo|String} movie リクエストする動画の動画IDかNicoVideoInfoオブジェクト
    # @return {Promise}
    ###
    pushRequest     : (movie) ->
        promise = if typeof movie is "string"
            @_session.video.getVideoInfo(movie)
        else
            Promise.resolve(movie)

        promise.then (movie) =>
            movieId = movie.id
            liveId = @_live.get("stream.liveId")

            Promise.all([APIEndpoints.nsen.request(@_session, {liveId, movieId}), movie])

        .then ([res, movie]) =>
            $res = Cheerio.load(res.body)(":root")

            return unless $res.attr("status") is "ok"
                Promise.reject new NicoException
                    message     : "Failed to push request"
                    code        : $res.find("error code").text()
                    response    : res

            @_requestedMovie = movie
            @emit "did-send-request", movie
            Promise.resolve()


    ###*
    # リクエストをキャンセルします
    # @return {Promise}
    #   キャンセルに成功すればresolveされます。
    #   (事前にリクエストが送信されていない場合もresolveされます。）
    #   リクエストに失敗した時、エラーメッセージつきでrejectされます。
    ###
    cancelRequest   : ->
        if not @_requestedMovie
            return Promise.resolve()

        liveId  = @_live.get("stream").liveId

        APIEndpoints.nsen.cancelRequest(@_session, {liveId})
        .then (res) =>
            $res = Cheerio.load(res.body)(":root")

            return if $res.attr("status") isnt "ok"
                Promise.reject new NicoException
                    message     : "Failed to cancel request"
                    code        : $res.find("error code").text()
                    response    : res.body

            @emit "did-cancel-request", @_requestedMovie
            @_requestedMovie = null
            Promise.resolve()


    ###*
    # Goodを送信します。
    # @return {Promise}
    #   成功したらresolveされます。
    #   失敗した時、エラーメッセージつきでrejectされます。
    ###
    pushGood        : ->
        liveId  = @_live.get("stream").liveId

        APIEndpoints.nsen.sendGood(@_session, {liveId})
        .then (res) =>
            $res = Cheerio.load(res.body)(":root")

            return if $res.attr("status") isnt "ok"
                Promise.reject new NicoException
                    message     : "Failed to push good"
                    code        : $res.find("error code").text()
                    response    : res.body

            @emit "did-push-good"
            Promise.resolve()



    ###*
    # SkipRequestを送信します。
    # @return {Promise}
    #   成功したらresolveされます。
    #   失敗した時、エラーメッセージつきでrejectされます。
    ###
    pushSkip        : ->
        liveId  = @_live.get("stream").liveId
        movieId = @getCurrentVideo()?.id?

        if ! @isSkipRequestable()
            return Promise.reject "Skip request already sended."

        APIEndpoints.nsen.sendSkip(@_session, {liveId})
        .then (res) =>
            $res = Cheerio.load(res.body).find(":root")

            # 通信に失敗
            return if $res.attr("status") isnt "ok"
                Promise.reject new NicoException
                    message     : "Failed to push skip"
                    code        : $res.find("error code").text()
                    response    : res.body

            @_lastSkippedMovieId = movieId
            @emit "did-push-skip"
            Promise.resolve()


    ###*
    # コメントを投稿します。
    # @param {String} msg 投稿するコメント
    # @param {String|Array.<String>} [command] コマンド(184, bigなど)
    # @param {Number} [timeoutMs]
    # @return {Promise} 投稿に成功すればresolveされ、
    #   失敗すればエラーメッセージとともにrejectされます。
    ###
    postComment : (msg, command = "", timeoutMs = 3000) ->
        @_commentProvider?.postComment(msg, command, timeoutMs)



    ###*
    # 次のチャンネル情報を受信していれば、その配信へ移動します。
    # @return {Promise}
    #   移動に成功すればresolveされ、それ以外の時にはrejectされます。
    ###
    moveToNextLive      : ->
        return Promise.reject() unless @_nextLiveId?

        liveId = @_nextLiveId
        return unless liveId?
            Promise.reject new NicoException
                message : "Next liveId is unknown."

        # 放送情報を取得
        @_session.live.getLiveInfo(liveId)
        .then (liveInfo) =>
            @_attachLive(liveInfo)
            @emit "did-change-stream", liveInfo
            @fetch()



    #
    # Event Listeners
    #

    ###*
    # コメントを受信した時のイベントリスナ。
    #
    # 制御コメントの中からNsen内イベントを通知するコメントを取得して
    # 関係するイベントを発火させます。
    # @param {LiveComment} comment
    ###
    _didCommentReceived     : (comment, options = {ignoreVideoChanged : false}) ->
        if comment.isControlComment() or comment.isPostByDistributor()
            [command, params...] = comment.comment.split(" ")
            @_processLiveCommands command, params, options

        @emit "did-receive-comment", comment
        return


    ###*
    # 配信情報が更新された時に実行される
    # 再生中の動画などのデータを取得する
    # @param {NicoLiveInfo} live
    ###
    _didLiveInfoUpdated      : ->
        content = @_live.get("stream").contents[0]?.content
        videoId = content and content.match(/^smile:((?:sm|nm)[1-9][0-9]*)/)

        unless videoId?[1]?
           @_didDetectMovieChange null
           return

        if (not @_playingMovie?) or @_playingMovie.id isnt videoId
            @_didDetectMovieChange videoId[1]

    _willMovieChange : (videoId) ->
        @_session.video.getVideoInfo(videoId).then (video) =>
            @emit "will-change-movie", video
            return


    ###*
    # 再生中の動画の変更を検知した時に呼ばれるメソッド
    # @private
    # @param {String} videoId 次に再生される動画のID
    ###
    _didDetectMovieChange  : (videoId) ->
        return if @_videoInfoFetcher?

        beforeVideo = @_playingMovie

        if videoId is null
            @emit "did-change-movie", null, beforeVideo
            @_playingMovie = null
            return

        return if beforeVideo?.id is videoId

        @_videoInfoFetcher = @_session.video.getVideoInfo(videoId).then (video) =>
            @_playingMovie = video
            @_videoInfoFetcher = null
            @emit "did-change-movie", video, beforeVideo
            return

        return


    ###*
    # チャンネルの内部放送IDの変更を検知するリスナ
    # @param {String} nextLiveId
    ###
    _willClose     : (nextLiveId) ->
        @_nextLiveId = nextLiveId


    ###*
    # 放送が終了した時のイベントリスナ
    ###
    _onLiveClosed   : ->
        @emit "ended"

        # 放送情報を差し替え
        @moveToNextLive()


    ###*
    # 再生中の動画が変わった時のイベントリスナ
    ###
    _didChangeMovie     : ->
        @_lastSkippedMovieId = null
        @emit "did-available-skip"




    #
    # Event Handlers
    #

    ###*
    # @event NsenChannel#did-receive-comment
    # @param {NicoLiveComment} comment
    ###
    onDidReceiveComment : (listener) ->
        @on "did-receive-comment", listener


    ###*
    # @event NsenChannel#did-receive-good
    ###
    onDidReceiveGood : (listener) ->
        @on "did-receive-good", listener


    ###*
    # @event NsenChannel#did-receive-add-mylist
    ###
    onDidReceiveAddMylist : (listener) ->
        @on "did-receive-add-mylist", listener


    ###*
    # @event NsenChannel#did-push-good
    ###
    onDidPushGood : (listener) ->
        @on "did-push-good", listener


    ###*
    # @event NsenChannel#did-push-skip
    ###
    onDidPushSkip : (listener) ->
        @on "did-push-skip", listener


    ###*
    # @event NsenChannel#did-send-request
    # @param {NicoVideoInfo} movie
    ###
    onDidSendRequest : (listener) ->
        @on "did-send-request", listener


    ###*
    # @event NsenChannel#did-cancel-request
    # @param {NicoVideoInfo}
    ###
    onDidCancelRequest : (listener) ->
        @on "did-cancel-request", listener

    ###*
    # @event NsenChannel#will-change-movie
    # @param {NicoVideoInfo} movie
    ###
    onWillChangeMovie : (listener) ->
        @on "will-change-movie", listener

    ###*
    # @event NsenChannel#did-change-movie
    # @param {NicoVideoInfo} nextMovie
    # @param {NicoVideoInfo} beforeMovie
    ###
    onDidChangeMovie : (listener) ->
        @on "did-change-movie", listener


    ###*
    # @event NsenChannel#did-available-skip
    ###
    onDidAvailableSkip : (listener) ->
        @on "did-available-skip", listener


    ###*
    # @event NsenChannel#will-close
    # @param {String} nextLiveId
    ###
    onWillClose : (listener) ->
        @on "will-close", listener


    ###*
    # @event NsenChannel#did-receive-request-state
    # @param {String} newState
    ###
    onDidReceiveRequestState : (listener) ->
        @on "did-receive-request-state", listener

    ###*
    # @event NsenChannel#did-change-panel-state
    # @property {Boolean} goodBtn
    # @property {Boolean} mylistBtn
    # @property {Boolean} skipBtn
    # @property {String} title
    # @property {Number} view
    # @property {Number} comment
    # @property {Number} mylist
    # @property {Date} uploadDate
    # @property {Number} playlistLen
    # @property {Boolean} corner
    # @property {Number} gage
    # @property {Number} tv
    ###
    onDidChangePanelState : (listener) ->
        @on "did-change-panel-state", listener


    ###*
    # @event NsenChannel#did-receive-tvchan-message
    # @param {String} message
    ###
    onDidReceiveTvchanMessage : (listener) ->
        @on "did-receive-tvchan-message", listener

    ###*
    # @event NsenChannel#will-dispose
    ###
    onWillDispose : (listener) ->
        @on "will-dispose", listener
