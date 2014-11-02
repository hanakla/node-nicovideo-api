#
# ニコニコ生放送の放送情報のモデルです。
# Backbone.Modelを継承しています。
#
# Methods
#  - isValid: boolean
#       放送情報が正しく取得されているか検証します。
#  - isEnded: boolean
#       配信が終了しているか判定します。
#  - isOfficial: boolean
#       公式放送番組か判定します。
#  - isNsen: boolean
#       放送がNsenのチャンネルか判定します。
#  - commentProvider: CommentProvider
#       この放送へのコメント送受信を行うCommentProviderオブジェクトを取得します。
#  - destroy: void
#       インスタンスが破棄可能か調べ、可能であれば破棄します。
#
# Events
#  - error  : (msg: String)
#       番組情報の同期中にエラーが発生した時に発火します。
#  - sync   : ()
#       放送情報を最新状態と同期した時に発火します。
#  - boforeDestroy:(requireKeep: Function)
#       インスタンスが破棄される前に発火します。
#       インスタンスの破棄によって不都合が生じる可能性がある場合
#       リスナーはrequireKeepをコールしてください
#  - destroy: ()
#       インスタンスが破棄された時に発火します。
#  - ended : ()
#       配信が終了した時に発火します。
#
# Properties
#   stream:     -- 放送の基礎情報
#       liveId:         string -- 放送ID
#       title:          string -- 放送タイトル
#       description:    string -- 放送の説明
#
#       watchCount:     number -- 視聴数
#       commentCount:   number -- コメント数
#
#       baseTime:       Date -- 生放送の時間の関わる計算の"元になる時間"
#       startTime:      Date -- 放送の開始時刻
#       openTime:       Date -- 放送の開場時間
#       endTime:        Date -- 放送の終了時刻（放送中であれば終了予定時刻）
#
#       isOfficial:     boolean -- 公式配信か
#       isNsen:         boolean -- Nsenのチャンネルか
#       nsenType:       string -- Nsenのチャンネル種別（"nsen/***"の***の部分）
#
#       contents:       Array<Object>
#           id:             string -- メイン画面かサブ画面か
#           startTime:      number -- 再生開始時間
#           disableAudio:   boolean -- 音声が無効にされているか
#           disableVideo:   boolean -- 映像が無効にされているか
#           duration:       number|null -- 再生されているコンテンツの長さ（秒数）
#           title:          string|null -- 再生されているコンテンツのタイトル
#           content:        string -- 再生されているコンテンツのアドレス（動画の場合は"smile:動画ID"）
#
#   owner:      -- 配信者の情報
#       userId:         number -- ユーザーID
#       name:           string -- ユーザー名
#
#   user:       -- 自分自身の情報
#       id:             number -- ユーザーID
#       name:           string -- ユーザー名
#       isPremium:      boolean -- プレミアムアカウントか
#
#   rtmp:       -- 配信に関する情報。詳細不明
#       isFms:          boolean
#       port:           number
#       url:            string
#       ticket:         string
#
#   comment:    -- コメントサーバーの情報
#       addr:           string -- サーバーアドレス
#       port:           number -- サーバーポート
#       thread:         number -- この放送と対応するスレッドID
#

_           = require "lodash"
Backbone    = require "backbone"
request     = require "request"
sprintf     = require("sprintf").sprintf
cheerio     = require "cheerio"

CommentProvider = require "./CommentProvider"
NicoURL         = require "../NicoURL"

UPDATE_INTERVAL = 10000


_updateEventer = _.extend({}, Backbone.Events)


###*
# valがnullもしくはundefinedの時にdefを返します。
#
# @param {Object} val
# @param {Object} def
# @return {Object}
###
defaultVal = (val, def) ->
    return if val? then val else def


# 定期的にデータを取得しに行く
setInterval ->
    _updateEventer.trigger "intervalSync"
, UPDATE_INTERVAL



class NicoLiveInfo extends Backbone.Model
    @_cache     : {}


    # @type {CommentProvider}
    _commentProvider    : null

    # @type {NicoSession}
    _session             : null

    # @type {Object}
    defaults    :
        stream      :
            liveId      : null
            title       : null
            description : null

            watchCount  : -1
            commentCount    : -1

            baseTime    : null
            openTime    : null
            startTime   : null
            endTime     : null

            isOfficial  : false
            isNsen      : false
            nsenType    : null

            contents    : {
                #  id:string,
                #  startTime:number,
                #  disableAudio:boolean,
                #  disableVideo:boolean,
                #  duration:number|null,
                #  title:string|null,
                #  content:string
            }

        owner       :
            userId      : -1
            name        : null

        user        :
            id          : -1
            name        : null
            isPremium   : null

        rtmp        :
            isFms       : null
            port        : null
            url         : null
            ticket      : null

        comment     :
            addr        : null
            port        : -1
            thread      : null

        _hasError   : true


    ###*
    # @param {NicoSession}  session 認証チケット
    # @param {string}       liveId  放送ID
    ###
    constructor     : (session, liveId) ->
        if NicoLiveInfo._cache[liveId]?
            return _instances[liveId]

        super id: liveId
        @_session = session

        _.bindAll @
            , "_autoUpdate"
            , "_onClosed"

        # 自動アップデートイベントをリスニング
        _updateEventer.on "intervalSync", _onIntervalSync

        NicoLiveInfo._cache[liveId] = @


    ###*
    # 自動更新イベントのリスナ
    # @private
    ###
    _onIntervalSync     : ->
        try
            @fetch()
        catch e
            console.error e.message


    ###*
    # 配信終了イベントのリスナ
    # @private
    ###
    _onClosed       : ->
        @trigger "ended"
        _dispose this


    #
    # 放送情報が正しく同期されたか調べます。
    # @return {boolean}
    #
    isValid          : ->
        return !@get "_hasError"


    #
    # 公式放送か調べます。
    # @return {boolean}
    #
    isOfficial      : ->
        return !!@get("stream").isOfficial


    #
    # Nsenのチャンネルか調べます。
    # @return {boolean}
    #
    isNsen          : ->
        return !!@get("stream").isNsen


    #
    # 放送が終了しているか調べます。
    # @return {boolean}
    #
    isEnded         : ->
        return @get("isEnded") is true


    #
    # 割り当てられた認証チケットを取得します。
    # @return {NicoSession}
    #
    getSession      : ->
        return @_session


    #
    # この放送に対応するCommentProviderオブジェクトを取得します。
    # @return {?CommentProvider}
    #
    commentProvider  : ->
        if not @_commentProvider
            @_commentProvider = new CommentProvider @

        return @_commentProvider


    ###*
    # APIから取得した情報をパースします。
    # @private
    # @param {string} res API受信結果
    ###
    parse           : (res) ->
        $res    = cheerio(res)
        $root   = $res.find(":root")
        $stream = $res.find("stream")
        $user   = $res.find("user")
        $rtmp   = $res.find("rtmp")
        $ms     = $res.find("ms")
        val     = null

        if $root.attr("status") isnt "ok"
            msg = $res.find("error code").text()

            console.error "NicoLiveInfo[%s]: Failed live info fetch. (%s)", @id, msg
            @trigger "error", msg, @
            return _hasError: true

        val =
            # 放送情報
            stream  :
                liveId      : $stream.find("id").text()
                title       : $stream.find("title").text()
                description : $stream.find("description").text()

                watchCount  : $stream.find("watch_count").text()|0
                commentCount: $stream.find("comment_count")|0

                baseTime    : new Date(($stream.find("base_time").text()|0) * 1000)
                openTime    : new Date(($stream.find("open_time").text()|0) * 1000)
                startTime   : new Date(($stream.find("start_time").text()|0) * 1000)
                endTime     : new Date(($stream.find("end_time")|0) * 1000)

                isOfficial  : $stream.find("provider_type").text() is "official"
                isNsen      : $res.find("ns").length > 0
                nsenType    : $res.find("ns nstype").text()||null

                contents    : _.map $stream.find("contents_list contents"), (content) ->
                    $content = cheerio(content)
                    return {
                        id              : $content.attr("id")
                        startTime       : new Date(($content.attr("start_time")|0) * 1000)
                        disableAudio    : ($content.attr("disableAudio")|0) isnt 1
                        disableVideo    : ($content.attr("disableVideo")|0) isnt 1
                        duration        : defaultVal($content.attr("duration"), null)|0 # ついてない時がある
                        title           : defaultVal($content.attr("title"), null)      # ついてない時がある
                        content         : $content.text()
                    }

            # 放送者情報
            owner   :
                userId      : $stream.find("owner_id").text()|0
                name        : $stream.find("owner_name").text()

            # ユーザー情報
            user    :
                id          : $user.find("user_id").text()|0
                name        : $user.find("nickname").text()
                isPremium   : $user.find("is_premium").text() is "1"

            # RTMP情報
            rtmp    :
                isFms       : $rtmp.attr("is_fms") is "1"
                port        : $rtmp.attr("rtmpt_port")|0
                url         : $rtmp.find("url").text()
                ticket      : $rtmp.find("ticket").text()

            # コメントサーバー情報
            comment :
                addr        : $ms.find("addr").text()
                port        : $ms.find("port").text()|0
                thread      : $ms.find("thread").text()|0

            _hasError: $res.find("getplayerstatus").attr("status") isnt "ok"

        return val


    ###*
    # 番組情報を最新の状態に同期します。
    # @return {Promise}
    ###
    fetch           :  ->
        if @id is null
            return Promise.reject "Live id not specified."

        self    = @
        dfd     = Promise.defer()
        url     = sprintf NicoURL.Live.GET_PLAYER_STATUS, @id

        # getPlayerStatusの結果を取得
        request.get
            url     : url
            jar     : @_session.getCookieJar()
            , (err, res, body) ->

                # check errors
                if err? and res.statusCode is 503
                    err = sprintf "NicoLiveInfo[%s]: Nicovideo has in maintenance.", self.id

                if err
                    console.error "NicoLiveInfo[%s]: Failed live info fetch. (%s)", self.id, err

                    self.trigger "error", err, self
                    dfd.reject err

                    return

                # apply values
                if not self.set(self.parse(body))
                    return false

                # Create CommentProvider the first time getSta
                if not self._commentProvider?
                    self._commentProvider = new CommentProvider self

                    # 配信終了イベントをリスニング
                    self._commentProvider.on "ended", self._onClosed

                self.trigger "sync"
                dfd.resolve()

        return dfd.promise

    #
    # インスタンスが破棄可能か調べ、可能であれば破棄します。
    #
    destroy             : ->
        requireKeep = false
        @trigger "beforeDestroy", -> requireKeep = true

        if requireKeep is false
            _updateEventer.off "intervalSync", @_onIntervalSync
            @off()

            @_commentProvider.dispose()
            @_commentProvider = undefined
            @set "isEnded", true
            delete NicoLiveInfo._cache[@id]

    # 別名
    dispose             : ->
        @destroy()

    # Backbone.Modelのメソッドを無効化
    sync                : _.noop
    save                : _.noop


module.exports = NicoLiveInfo
