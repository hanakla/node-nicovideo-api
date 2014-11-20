###*
# Nsenのチャンネルと対応するモデルです。
# リクエストの送信とキャンセル、再生中の動画の取得と監視ができます。
#
# TODO:
#  WaitListの取得
#
# Methods
#   - getLiveInfo()         : NicoLiveInfo
#       現在接続中の配信のNicoLiveInfoオブジェクトを取得します。
#   - getCurrentVideo()     : NicoVideoInfo|null
#       現在再生中の動画情報を取得します。
#   - getChannelType()      : string
#       チャンネルの種別を取得します。（nsen/***の"***"の部分だけ）
#   - isSkipRequestable()   : boolean
#       今現在、スキップリクエストを送ることができるか検証します。
#   - pushRequest(movie: NicoVideoInfo)
#       リクエストを送信します。
#   - cancelRequest()
#       リクエストをキャンセルします。
#   - pushGood()
#       Goodを送信します。
#   - pushSkip()
#       SkipRequestを送信します。
#   - moveToNextLive()
#       次の配信情報を受け取っていれば、次の配信へ移動します。
#
# Events
#  - streamChanged: (newLive: NicoLiveInfo)
#      午前４時以降、インスタンス内部で参照している放送が切り変わった時に発火します。
#  - videochanged: (video:NicoVideoInfo|null, beforeVideo:NicoVideoInfo|null)
#      再生中の動画が変わった時に発火します。
#      第２引数に変更後の動画の情報が渡され、第３引数には変更前の動画の情報が渡されます。
#
#  - sendRequest:(video:NicoVideoInfo)
#      リクエストが完了した時に発火します。第２引数にリクエストされた動画の情報が渡されます。
#  - cancelRequest:(video:NicoVideoInfo)
#      リクエストがキャンセルされた時に発火します。第２引数にキャンセルされた動画の情報が渡されます。
#
#  - sendGood:()
#       Goodが送信された時に発火します。
#  - sendSkip:()
#       SkipRequestが送信された時に発火します。
#
#  - receiveGood:()
#       誰かがGoodを送信した時に発火します。
#  - receiveMylist:()
#       誰かが動画をマイリストに追加した時に発火します。
#
#  - skipAvailable:()
#       スキップリクエストが送信可能になった時に発火します。
#
#  - closing: (liveId:string)
#       午前４時くらいから送られ始める、更新リクエストを受け取った時に発火します。
#       第１引数は移動先の放送IDです。
#
#  - ended:()
#       配信が終了した時に発火します。
###
_               = require "lodash"
Backbone        = require "backbone"
cheerio         = require "cheerio"
request         = require "request"
sprintf         = require("sprintf").sprintf

NicoVideoApi    = require "../video/NicoVideoApi"
NicoLiveApi     = require "../live/NicoLiveApi"
NicoVideoInfo   = require "../video/NicoVideoInfo"
NicoLiveInfo    = require "./NicoLiveInfo"
NicoUrl         = require "../NicoURL"

NsenChannels    = require "./NsenChannels"

NSEN_URL_REQUEST        = NicoUrl.Live.NSEN_REQUEST
NSEN_URL_REQUEST_CANCEL = NicoUrl.Live.NSEN_REQUEST_CANCEL
NSEN_URL_REQUEST_SYNC   = NicoUrl.Live.NSEN_REQUEST_SYNC
NSEN_URL_GOOD           = NicoUrl.Live.NSEN_GOOD
NSEN_URL_SKIP           = NicoUrl.Live.NSEN_SKIP


###*
# コメント種別判定パターン
# @const {Object.<string, RegExp>
###
CommentRegExp =
    good        : /^\/nspanel show goodClick/i,
    mylist      : /^\/nspanel show mylistClick/i,
    reset       : /^\/reset (lv[0-9]*)/i,
    videoChange : /^\/play smile:((?:sm|nm)[1-9][0-9]*) main/,

###*
# 各チャンネル毎のインスタンス
# @type {Object.<string, NsenChannel>
###
_instances = {}


###*
# Nsenチャンネルのハンドラです。
# チャンネル上で発生するイベントを検知して通知します。
# @constructor
# @param {NicoLiveInfo liveInfo Nsenの配信を指すLiveInfoオブジェクト
###
class NsenChannel
    _.extend @::, Backbone.Events

    ###*
    # Nsenリクエスト時のエラーコード
    # @const {Object.<string, string>
    ###
    @RequestErrors  :
        not_login       : "ログインしていません。"
        nsen_close      : "現在リクエストを受け付けていません。"
        nsen_tag        : "リクエストに必要なタグが登録されていません。"
        nsen_long       : "動画が長過ぎます。"
        nsen_requested  : "リクエストされたばかりです。"

    @Channels       : NsenChannels

    @_cache         : {}


    ###*
    # @private
    # @type {NicoLiveInfo}
    ###
    _live           : null

    ###*
    # @private
    # @type {CommentProvider}
    ###
    _commentProvider : null

    ###*
    # @private
    # @type {NicoVideoApi}
    ###
    _videoApi       : null

    ###*
    # @private
    # @type {NicoLiveApi}
    ###
    _liveApi        : null

    ###*
    # @private
    # @type {NicoSession}
    ###
    _session         : null


    ###*
    # 再生中の動画情報
    # @private
    # @type {NicoLiveInfo}
    ###
    _playingMovie   : null

    ###*
    # 最後にリクエストした動画情報
    # @private
    # @type {NicoVideoInfo}
    ###
    _requestedMovie : null

    ###*
    # 最後にスキップした動画のID。
    # 比較用なので動画IDだけ。
    # @private
    # @type {string}
    ###
    _lastSkippedMovieId : null

    ###*
    # （午前４時遷移時の）移動先の配信のID
    # @type {string}
    ###
    _nextLiveId     : null


    _acceptVideoChangeDetectionFromComments : false

    constructor     : (liveInfo) ->
        if !liveInfo instanceof NicoLiveInfo
            throw new Error "Passed object not instance of NicoLiveInfo."

        if liveInfo.isNsen() is false
            throw new Error "This live is not Nsen live streaming."

        # インスタンス重複チェック
        nsenType = liveInfo.get("stream").nsenType
        if NsenChannel._cache[nsenType]? and not @_nextLiveId?
            return NsenChannel._cache[nsenType]
        else
            NsenChannel._cache[nsenType] = @

        _.bindAll this
            , "_onCommentAdded"
            , "_onLiveInfoUpdated"
            , "_onDetectionClosing"
            , "_onLiveClosed"
            , "_onVideoChanged"

        # 必要なオブジェクトを取得
        @_live              = liveInfo
        @_session           = liveInfo.getSession()
        @_commentProvider   = liveInfo.commentProvider()

        # イベントリスニング
        @_live
            .on "sync", @_onLiveInfoUpdated
            .on "ended", @_onLiveClosed

        @_commentProvider
            .on "add", @_onCommentAdded

        @
            .on "videochanged", @_onVideoChanged # 再生中の動画が変わった時
            .on "closing", @_onDetectionClosing # 配信終了前イベントが発された時

        _instances[nsenType] = this

        # 少し時間をおいてコメントからの動画変更検出を有効にする
        # （こうしないと過去ログからドバーッと動画変更履歴を検出してしまう）
        self = this
        setTimeout () ->
            self._acceptVideoChangeDetectionFromComments = true
        , 1000

        @fetch()


    ###*
    # コメントを受信した時のイベントリスナ。
    #
    # 制御コメントの中からNsen内イベントを通知するコメントを取得して
    # 関係するイベントを発火させます。
    # @param {LiveComment} comment
    ###
    _onCommentAdded     : (comment) ->
        if comment.isControl() || comment.isDistributorPost()
            com = comment.get "comment"

            if CommentRegExp.good.test(com)
                # 誰かがGood押した
                @trigger "receiveGood"
                return

            if CommentRegExp.mylist.test(com)
                # 誰かがマイリスに追加した
                @trigger "receiveMylist"
                return

            if CommentRegExp.reset.test(com)
                # ページ移動リクエストを受け付けた
                liveId = CommentRegExp.reset.exec com

                if liveId?[1]?
                    @trigger "closing", liveId[1]

            if CommentRegExp.videoChange.test(com)

                # 動画の再生リクエストを受け付けた
                if @_acceptVideoChangeDetectionFromComments is true
                    videoId = CommentRegExp.videoChange.exec com

                    if videoId?[1]?
                        @_onVideoChangeDetected videoId


    ###*
    # 配信情報が更新された時に実行される
    # 再生中の動画などのデータを取得する
    # @param {NicoLiveInfo} live
    ###
    _onLiveInfoUpdated      : () ->
        content = @_live.get("stream").contents[0]
        videoId = content && content.content.match(/^smile:((?:sm|nm)[1-9][0-9]*)/)

        unless videoId?[1]?
           console.info "NsenChannel[%s]: Playing movie is unknown.", @_live.get("stream").nsenType
           @_onVideoChangeDetected null
           return

        if not @_playingMovie? or @_playingMovie.id isnt videoId
            # 直前の再生中動画と異なれば情報を更新
            @_onVideoChangeDetected videoId[1]


    ###*
    # 再生中の動画の変更を検知した時に呼ばれるメソッド
    # @param {string} videoId
    ###
    _onVideoChangeDetected  : (videoId) ->
        self = @
        beforeVideo = @_playingMovie

        if not videoId?
            @trigger "videochanged", null, beforeVideo
            @_playingMovie = null
            return

        @_getVideoApi().getVideoInfo videoId
            .then (video) ->
                self._playingMovie = video
                self.trigger "videochanged", video, beforeVideo


    ###*
    # チャンネルの内部放送IDの変更を検知するリスナ
    # @param {string} nextLiveId
    ###
    _onDetectionClosing     : (nextLiveId) ->
        @_nextLiveId = nextLiveId


    ###*
    # 放送が終了した時のイベントリスナ
    ###
    _onLiveClosed   : () ->
        @trigger "ended"

        # 放送情報を差し替え
        @moveToNextLive()


    ###*
    # 再生中の動画が変わった時のイベントリスナ
    ###
    _onVideoChanged     : () ->
        @_lastSkippedMovieId = null
        @trigger "skipAvailable"


    ###*
    # ニコニコ動画APIオブジェクトを取得します。
    # @private
    # @return {NicoVideoApi}
    ###
    _getVideoApi        : ->
        if not @_videoApi?
            @_videoApi = new NicoVideoApi @_session

        return @_videoApi


    ###*
    # 生放送APIオブジェクトを取得します。
    # @private
    # @return {NicoLiveApi}
    ###
    _getLiveApi         : ->
        if not @_liveApi?
            @_liveApi = new NicoLiveApi @_session

        return @_liveApi


    ###*
    # チャンネルの種類を取得します。
    # @return {string} "vocaloid", "toho"など
    ###
    getChannelType  : () ->
        return @_live.get("stream").nsenType


    ###*
    # 現在接続中の放送のNicoLiveInfoオブジェクトを取得します。
    # @return {NicoLiveInfo}
    ###
    getLiveInfo     : () ->
        return @_live


    ###*
    # 現在再生中の動画情報を取得します。
    # @return {NicoVideoInfo?}
    ###
    getCurrentVideo     : () ->
        return @_playingMovie


    ###*
    # スキップリクエストを送信可能か確認します。
    # 基本的には、sendSkipイベント、skipAvailableイベントで
    # 状態の変更を確認するようにします。
    # @return {boolean
    ###
    isSkipRequestable   : () ->
        video = @getCurrentVideo()
        return (video isnt null) and (@_lastSkippedMovieId isnt video.id)


    ###*
    # サーバー側の情報とインスタンスの情報を同期します。
    # @return {Promise}
    ###
    fetch               : () ->
        unless @_live?
            console.info "NsenChannel: LiveInfo not binded."
            return Promise.reject "LiveInfo not binded."


        # リクエストした動画の情報を取得
        self    = @
        dfd     = Promise.defer()
        liveId  = @_live.get("stream").liveId
        url     = sprintf NSEN_URL_REQUEST_SYNC, liveId

        request.get
            url     : url
            jar     : @_session.getCookieJar()
            , (err, res, body) ->
                $res = cheerio.load(body)(":root")

                if err?
                    dfd.reject err
                    return

                if $res.attr("status") is "ok"
                    # リクエストの取得に成功したら動画情報を同期
                    videoId = $res.find("id").text()

                    # 直前にリクエストした動画と内容が異なれば
                    # 新しい動画に更新
                    if not self._requestedMovie? or self._requestedMovie.id isnt videoId
                        self._getVideoApi().getVideoInfo videoId
                            .then (movie) ->
                                self._requestedMovie = movie
                                self.trigger "sendRequest", movie
                                dfd.resolve()
                                return
                            .catch (msg) ->
                                dfd.reject msg
                                return

        return dfd.promise


    ###*
    # リクエストを送信します。
    # @param    {NicoVideoInfo} movie
    #   リクエストする動画のNicoVideoInfoオブジェクト
    # @return   {Promise}
    #   リクエストに成功したらresolveされます。
    #   リクエストに失敗した時、Errorオブジェクトつきでrejectされます。
    ###
    pushRequest     : (movie) ->
        if not NicoVideoInfo.isInstance movie
            return

        self    = @
        dfd     = Promise.defer()
        liveId  = @_live.get("stream").liveId
        movieId = movie.id
        url     = sprintf NSEN_URL_REQUEST, liveId, movieId

        # NsenAPIにリクエストを送信する
        request.get
            url     : url
            jar     : @_session.getCookieJar()
            , (err, res, body) ->
                # 通信エラー
                if err?
                    console.error "NsenChannel[%s]: Failed to request pushing. (%s)", self.id, err
                    dfd.reject sprintf "Failed to request pushing. (%s)", err
                    return

                # 送信に成功したら、正しくリクエストされたか確認する
                $res    = cheerio.load(body)(":root")
                result  = $res.attr("status") is "ok"

                if result
                    # リクエスト成功
                    self._requestedMovie = movie
                    self.trigger "requested", movie
                    dfd.resolve()
                 else
                    # リクエスト失敗
                    # エラーメッセージを取得
                    errCode = $res.find("error code").text()
                    reason = NsenChannel.RequestErrors[errCode]

                    if not reason?
                        reason = errCode

                    dfd.reject sprintf("NsenChannel[%s]: %s", self.id, reason)

        return dfd.promise


    ###*
    # リクエストをキャンセルします
    # @return {Promise}
    #   キャンセルに成功すればresolveされます。
    #   (事前にリクエストが送信されていない場合もresolveされます。）
    #   リクエストに失敗した時、エラーメッセージつきでrejectされます。
    ###
    cancelRequest   : () ->
        if not @_requestedMovie
            return Promise.reject("リクエストした動画はありません").promise

        self    = @
        dfr     = Promise.defer()
        liveId  = @_live.get("stream").liveId
        url     = sprintf NSEN_URL_REQUEST_CANCEL, liveId

        # NsenAPIにリクエストキャンセルを送信
        request.get
            url     : url
            jar     : @_session.getCookieJar()
            , (err, res, body) ->
                $res = cheerio.load(body)(":root")

                if err?
                    console.error ""

                if $res.attr "status" is "ok"
                    self.trigger "cancelRequest", self._requestedMovie
                    self._requestedMovie = null
                    dfr.resolve()
                else
                    dfr.reject $res.find("error code").text()

        return dfr.promise


    ###*
    # Goodを送信します。
    # @return {Promise}
    #   成功したらresolveされます。
    #   失敗した時、エラーメッセージつきでrejectされます。
    ###
    pushGood        : ->
        self    = @
        dfr     = Promise.defer()
        liveId  = @_live.get("stream").liveId

        request.get
            url     : sprintf NSEN_URL_GOOD, liveId
            jar     : @_session.getCookieJar()
        , (err, res, body) ->
                if err?
                    dfr.reject err

                $res = cheerio.load(body)(":root")
                result = $res.attr("status") is "ok"

                if result
                    self.trigger "sendGood"
                    dfr.resolve()
                 else
                    dfr.reject $res.find("error code").text()

                return

        return dfr.promise


    ###*
    # SkipRequestを送信します。
    # @return {Promise}
    #   成功したらresolveされます。
    #   失敗した時、エラーメッセージつきでrejectされます。
    ###
    pushSkip        : ->
        self    = @
        dfr     = Promise.defer()
        liveId  = @_live.get("stream").liveId
        movieId = @getCurrentVideo()?.id?

        if ! @isSkipRequestable()
            return Promise.reject "Skip request already sended."

        request.get
            url     : sprintf NSEN_URL_SKIP, liveId
            jar     : @_session.getCookieJar()
        , (err, res, body) ->
            if err?
                dfr.reject err

            $res = cheerio.load(body).find(":root")
            status = $res.attr("status") is "ok"

            # 通信に失敗
            if status
                self._lastSkippedMovieId = movieId
                self.trigger "sendSkip"
                dfr.resolve()
             else
                dfr.reject $res.find("error code").text()

        return dfr.promise


    ###*
    # 次のチャンネル情報を受信していれば、その配信へ移動します。
    # @return {Promise}
    #   移動に成功すればresolveされ、それ以外の時にはrejectされます。
    ###
    moveToNextLive      : () ->
        if @_nextLiveId?
            return Promise.reject()

        self    = @
        dfd     = Promise.defer()
        liveId  = @_nextLiveId

        # 放送情報を取得
        @_getLiveApi.getLiveInfo liveId
            .then (liveInfo) ->
                # 放送情報の取得に成功した

                # イベントリスニングを停止
                self._live
                    .off "sync", self._onLiveInfoUpdated
                    .off "closed", self._onLiveClosed

                self._commentProvider
                    .off "add", self._onCommentAdded

                # オブジェクトを破棄
                self._live? and self._live.dispose()
                self._live = null
                self._commentProvider = null

                # 新しい番組情報に切り替え
                self._live = liveInfo
                self._commentProvider = liveInfo.getCommentProvider()

                # イベントリスニング開始
                self._live
                    .on "sync", self._onLiveInfoUpdated
                    .on "closed", self._onLiveClosed

                self._commentProvider
                    .on "add", self._onCommentAdded

                self._nextLiveId = null

                # 配信変更イベントを発生させる。
                self.trigger "streamChanged", liveInfo
                console.info "NsenChannel[nsne/%s]: Live stream changed", self.getChannelType()
                dfd.resolve()

                self.fetch()
            .catch (err) ->
                # 放送情報の取得に失敗
                dfd.reject err

        return dfd.promise


module.exports = NsenChannel
