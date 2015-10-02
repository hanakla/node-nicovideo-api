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

    @_cache         : {}


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

        @_attachLive(liveInfo)


    _attachLive : (liveInfo) ->
        @_channelSubscriptions?.dispose()
        @_channelSubscriptions = sub = new CompositeDisposable

        @_live = liveInfo

        sub.add liveInfo.onDidRefresh =>
            @_didLiveInfoUpdated()

        liveInfo.commentProvider({connect: true})
        .then (provider) =>
            @_commentProvider = provider

            if provider.isFirstResponseProsessed is no
                sub.add provider.onDidProcessFirstResponse (comments) =>
                    comments.forEach (comment) =>
                        @_didCommentReceived comment, {ignoreVideoChanged: true}

                    sub.add provider.onDidReceiveComment (comment) =>
                        @_didCommentReceived(comment)

            else
                sub.add provider.onDidReceiveComment (comment) =>
                    @_didCommentReceived(comment)

            sub.add provider.onDidEndLive =>
                @_onLiveClosed()

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
    # 現在再生中の動画情報を取得します。
    # @return {NicoVideoInfo?}
    ###
    getCurrentVideo     : ->
        return @_playingMovie


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
    _processLiveCommands : (command, params = []) ->
        switch command
            when "/prepare"
                @emit "will-change-movie"

            when "/play"
                [source, view, title] = params
                videoId = /smile:((?:sm|nm)[1-9][0-9]*)/.exec(source)

                if videoId?[1]?
                    @emit "did-change-movie", videoId[1]

            when "/reset"
                [nextLiveId] = params
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
        return if operation isnt "show"

        switch entity
            when "goodClick"
                @emit "did-receive-good"
                return

            when "mylistClick"
                @emit "did-receive-add-mylist"
                return

        panelState = QueryString.parse(entity)

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
        unless @_live?
            return Promise.reject "LiveInfo not attached."


        # リクエストした動画の情報を取得
        liveId  = @_live.get("stream").liveId

        APIEndpoints.nsen.syncRequest(@_session, {liveId})
        .then (res) =>
            $res = Cheerio.load(res.body)(":root")

            if $res.attr("status") is "ok"
                # リクエストの取得に成功したら動画情報を同期
                videoId = $res.find("id").text()

                # 直前にリクエストした動画と内容が異なれば
                # 新しい動画に更新
                if not @_requestedMovie? or @_requestedMovie.id isnt videoId
                    @_getVideoApi().getVideoInfo videoId
                        .then (movie) ->
                            @_requestedMovie = movie
                            @emit "sendRequest", movie
                            Promise.resolve()
                            return
                        .catch (msg) ->
                            Promise.reject msg
                            return



    dispose         : ->
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
        # @_canContinue()

        promise = if typeof movie is "string"
            @_session.video.getVideoInfo(movie)
        else
            promise = Promise.resolve(movie)

        promise.then (movie) =>
            movieId = movie.id
            liveId = @_live.get("stream.liveId")

            APIEndpoints.nsen.request(@_session, {liveId, movieId})
            .then (res) =>
                $res = Cheerio.load(res.body)(":root")
                success = $res.attr("status") is "ok"

                unless success
                   errCode = $res.find("error code").text()
                   message = sprintf("NsenChannel[%s]: %s", @getChannelType(), reason)
                   return Promise.reject new NicoException(message, errCode)

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

            if $res.attr("status") isnt "ok"
                errCode = $res.find("error code").text()
                return Promise.reject new NicoException("[NsenChannel: #{@id}] Failed to request canceling.", errCode)

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
            success = $res.attr("status") is "ok"

            if success is no
                errCode = $res.find("error code").text()
                return Promise.reject new NicoException("Failed to push good.", errCode)

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
            success = $res.attr("status") is "ok"

            # 通信に失敗
            if success is no
                errCode = $res.find("error code").text()
                return Promise.reject new NicoException("Failed to push skip")

            @_lastSkippedMovieId = movieId
            @emit "did-push-skip"
            Promise.resolve()



    ###*
    # 次のチャンネル情報を受信していれば、その配信へ移動します。
    # @return {Promise}
    #   移動に成功すればresolveされ、それ以外の時にはrejectされます。
    ###
    _moveToNextLive      : ->
        return Promise.reject() if @_nextLiveId?

        liveId  = @_nextLiveId

        return Promise.reject(new NicoException("Next liveId is unknown.")) unless liveId?

        # 放送情報を取得
        @_session.live.getLiveInfo liveId
        .then (liveInfo) =>
            # オブジェクトを破棄
            @_live = null
            @_commentProvider = null

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
            @_processLiveCommands comment.comment.split(" ")

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


    ###*
    # 再生中の動画の変更を検知した時に呼ばれるメソッド
    # @private
    # @param {String} videoId
    ###
    _didDetectMovieChange  : (videoId) ->
        beforeVideo = @_playingMovie

        if videoId is null
            @emit "did-change-movie", null, beforeVideo
            @_playingMovie = null
            return

        @_session.video.getVideoInfo(videoId).then (video) =>
            @_playingMovie = video
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
        @_moveToNextLive()


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
    # @event NsenChannel#did-change-movie
    # @param {NicoVideoInfo} beforeMovie
    # @param {NicoVideoInfo} nexeMovie
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
