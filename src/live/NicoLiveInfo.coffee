###
# ニコニコ生放送の配信情報
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
# @class NicoLiveInfo
###

_ = require "lodash"
__ = require "lodash-deep"
Cheerio = require "cheerio"
Request = require "request-promise"
{sprintf} = require "sprintf"

APIEndpoints = require "../APIEndpoints"
NicoURL = require "../NicoURL"
NicoException = require "../NicoException"
Emitter = require "../Emitter"
CommentProvider = require "./CommentProvider"

module.exports =
class NicoLiveInfo extends Emitter

    ###*
    # @propery {Object}
    ###
    @defaults :
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
    # @static
    # @return {Promise}
    ###
    @instanceFor : (liveId, session) ->
        if typeof liveId isnt "string" or liveId is ""
            throw new TypeError("liveId must bea string")

        live = new NicoLiveInfo(liveId, session)
        live.fetch().then -> Promise.resolve(live)


    ###*
    # マイリストが最新の内容に更新された時に発火します
    # @event MyList#did-refresh
    # @property {NicoLiveInfo}  live
    ###

    ###*
    # @private
    # @property {CommentProvider}   _commentProvider
    ###
    _commentProvider : null

    ###*
    # @private
    # @property {NicoSession}   _session
    ###
    _session : null

    ###*
    # @private
    # @property {Object}    _attr
    ###
    _attr : null

    ###*
    # @property {String}    id
    ###


    ###*
    # @param {NicoSession}  session 認証チケット
    # @param {string}       liveId  放送ID
    ###
    constructor     : (liveId, @_session) ->
        super

        Object.defineProperties @,
            id :
                value : liveId


    ###*
    # 公式放送か調べます。
    # @return {boolean}
    ###
    isOfficialLive : ->
        !!@get("stream").isOfficial


    ###*
    # Nsenのチャンネルか調べます。
    # @return {boolean}
    ###
    isNsenLive : ->
        !!@get("stream").isNsen


    ###*
    # 放送が終了しているか調べます。
    # @return {boolean}
    ###
    isEnded         : ->
        @get("isEnded") is true


    ###*
    # @param {String}   path
    ###
    get : (path) ->
        __.deepGet @_attr, path


    ###*
    # この放送に対応するCommentProviderオブジェクトを取得します。
    # @param {Object} options 接続設定
    # @param {Number} [options.firstGetComments] 接続時に取得するコメント数
    # @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
    # @param {Boolean} [options.connect=true] trueを指定するとコネクション確立後にresolveします
    # @return {Promise}
    ###
    commentProvider  : (options = {
        connect: true
    }) ->
        unless @_commentProvider?
            return CommentProvider.instanceFor(@, options).then (provider) =>
                @_commentProvider = provider
                provider.onDidEndLive @_didEndLive.bind(@)

                if options.connect
                    provider.connect(options)
                else
                    Promise.resolve provider

        Promise.resolve @_commentProvider


    ###*
    # APIから取得した情報をパースします。
    # @private
    # @param {String}   res     API受信結果
    ###
    parse           : (res) ->
        $res    = Cheerio.load res
        $root   = $res ":root"
        $stream = $res "stream"
        $user   = $res "user"
        $rtmp   = $res "rtmp"
        $ms     = $res "ms"
        props     = null

        if $root.attr("status") isnt "ok"
            errorCode = $res("error code").text()
            throw new NicoException
                message: "Failed to parse live info (#{errorCode})"
                code : errorCode
                response : res

        props =
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
                isNsen      : $res("ns").length > 0
                nsenType    : $res("ns nstype").text() or null

                contents    : _.map $stream.find("contents_list contents"), (el) ->
                    $content = Cheerio el
                    {
                        id              : $content.attr("id")
                        startTime       : new Date(($content.attr("start_time")|0) * 1000)
                        disableAudio    : ($content.attr("disableAudio")|0) is 1
                        disableVideo    : ($content.attr("disableVideo")|0) is 1
                        duration        : $content.attr("duration")|0 ? null # ついてない時がある
                        title           : $content.attr("title") ? null      # ついてない時がある
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

            _hasError: $res("getplayerstatus").attr("status") isnt "ok"

        props


    ###*
    # 番組情報を最新の状態に同期します。
    # @return {Promise}
    ###
    fetch :  ->
        APIEndpoints.live.getPlayerStatus(@_session, {liveId : @id})
        .then (res) =>
            # check errors
            if res.statusCode is 503
                return Promise.reject new Error(sprintf("Live[%s]: Nicovideo has in maintenance.", @id))

            @_attr = @parse(res.body)
            @emit "did-refresh", @

            Promise.resolve()

    ###*
    # 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
    ###
    dispose : ->
        @_commentProvider?.dispose()
        @_commentProvider = null
        delete NicoLiveInfo._cache[@id]
        super


    #
    # Event Listeners
    #

    _didEndLive : ->
        @_attr.isEnded = true
        return


    #
    # Event Handlers
    #
    onDidRefresh : (listener) ->
        @on "did-refresh", listener
