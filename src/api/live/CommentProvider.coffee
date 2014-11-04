###*
# 放送中の番組のコメントの取得と投稿を行うクラスです。
#
# NicoLiveInfo#commentProviderメソッドを通じてインスタンスを取得します。
# Backbone.Collectionを継承しています。
#
# Methods:
#  - getLiveInfo(): LiveInfo
#       配信情報オブジェクトを取得します。
#  - postComment(msg: string, command: string): Promise
#       コメントを投稿します。
#       投稿に成功すればresolveされ、失敗すれば投稿結果オブジェクトとともにrejectされます。
#       投稿結果オブジェクトは以下の形式のオブジェクトです。
#       {code:number, message:string} -- code:エラーコード, message:エラーメッセージ
#
# Events:
#  - receive: (rawXMLComment: string)
#       コメントサーバーからレスポンスを受け取った際に発火します。
#  - add: (model:NicoLiveComment)
#       コメントを受信した際に発火します。
#  - error: (error:Error)
#       コネクションエラーが発生した際に発火します。
#  - ended: (live: NicoLiveInfo)
#       配信が終了した際に発火します。
#  - disconnected:()
#       コメントサーバから切断した時に発火します。
#  - closed:()
#       コメントサーバーから切断された際に発火します。
#
###
INIT_GET_RESPONSES = 200
SEND_TIMEOUT = 3000

_           = require "lodash"
Backbone    = require "backbone"
net         = require "net"
cheerio     = require "cheerio"
request     = require "request"
sprintf     = require("sprintf").sprintf

NicoUrl     = require "../NicoURL"
NicoLiveComment = require "./NicoLiveComment"


CHAT_RESULT =
    SUCCESS             : 0
    FAIL                : 1
    THREAD_ID_ERROR     : 2
    TICKET_ERROR        : 3
    DIFFERENT_POSTKEY   : 4
    _DIFFERENT_POSTKEY  : 8
    LOCKED              : 5


COMMANDS =
    connect : _.template """
        <thread thread="<%-thread%>" version="20061206"
         res_from="#{-INIT_GET_RESPONSES}"/>
    """
    post    : _.template """
        <chat thread="<%-threadId%>" ticket="<%-ticket%>"
         postkey="<%-postKey%>" mail="<%-command%>" user_id="<%-userId%>"
         premium="<%-isPremium%>"><%-comment%></chat>
    """


class CommentProvider extends Backbone.Collection

    # @type {NicoLiveInfo}
    _live       : null

    # @type {Net.Socket}
    _connection : null

    # コメント投稿に必要な情報
    _postInfo   :
        ticket      : null
        postKey     : null
        threadId    : null


    constructor     : (liveInfo) ->
        unless liveInfo?
            throw new Error "Can not passed LiveInfo object"

        Backbone.Collection.call @

        @_postInfo  = _.clone(this._postInfo)
        @_live      = liveInfo

        _.bindAll @
            , "_onCommentReceive"
            , "_onErrorOnConnection"
            , "_onConnectionClose"
            , "_rawCommentProcessor"
            #, "_responseParser"
            #, "_threadInfoDetector"
            #, "_postResultDetector"
            #, "_liveEndDetector"
            , "_onLiveInfoSynced"
            #, "_onAuthLogout"

        @.once "receive", @_threadInfoDetector    # スレッド情報リスナを登録

        liveInfo.on "sync", @_onLiveInfoSynced

        liveInfo.getSession().once "logout", => @_disconnect

        liveInfo.initThen =>
            try
                # コメントサーバーへ接続
                @_initConnection()
            catch e
                console.error "CommentProvider[%s]: Connection failed.", @_live.get "id", e


    #
    # コメントサーバへ接続します。
    # @private
    # @param {CommentProvider} self
    #
    _initConnection     : ->
        self        = @
        serverInfo  = @_live.get "comment"

        # コメントサーバーへ接続する
        @_connection = net.connect serverInfo.port, serverInfo.addr

        @_connection
            # 接続完了したら送信要求を送る
            .once "connect", ->
                self._connection.write COMMANDS.connect(serverInfo) + '\0'

            # コメントを受信した時
            .on "data", @_onCommentReceive

            # 接続エラーが起きた時
            .once "error", @_onErrorOnConnection

            # 接続が閉じた時
            .once "close", @_onConnectionClose

        return


    #
    # コメント受信処理
    #
    _onCommentReceive    : (data) ->
        self    = @
        $c      = cheerio.load "<res>#{data}</res>"

        # 要素をばらしてイベントを呼ぶ
        $c("*").each ->
            self._rawCommentProcessor cheerio(@).toString()

    #
    #
    #
    _rawCommentProcessor    : (rawXMLComment) ->
        $thread = cheerio rawXMLComment

        @trigger "receive", rawXMLComment

        switch true
            # 受信したデータからNicoLiveCommentインスタンスを生成してイベントを発火させる
            when $thread.is "chat"
                comment = NicoLiveComment.fromRawXml rawXMLComment

                # 時々流れてくるよくわからない無効データは破棄
                if comment.get("comment") is ""
                    return

                # NicoLiveCommentの自己ポスト判定が甘いので厳密に。
                if comment.get("user").id is this._live.get("user").id
                    comment.set "isMyPost", true

                # 配信終了通知が来たら切断
                if comment.get("comment") is "/disconnect"
                    @trigger "ended", @_live
                    @_disconnect()

                this.add comment

            # 最初の接続応答を受け付け
            when $thread.is "thread"
                # チケットを取得
                @_postInfo.ticket = $thread.attr "ticket"
                console.info "CommentProvider[%s]: Receive thread info", @_live.get("id")

            # 自分のコメント投稿結果を受信
            when $thread.is "chat_result"
                status = $thread.attr "status"
                status = status | 0
                @trigger "_chatresult", {status}

        return



    #
    # コネクション上のエラー処理
    #
    _onErrorOnConnection : (err) ->
        @trigger "error", err.message


    #
    # コネクションが閉じられた時の処理
    # @private
    #
    _onConnectionClose  : (hadError) ->
        if hadError
            @trigger "error", "Connection closing error (unknown)"

        @trigger "closed"


    #
    # コメントサーバのスレッドID変更を監視するリスナ
    # @private
    #
    _onLiveInfoSynced       : ->
        # 時々threadIdが変わるのでその変化を監視
        @_postInfo.threadId = @_live.get("comment").thread
        return


    #
    # コメントサーバから切断します。
    # @private
    #
    _disconnect             : ->
        if @_connection?
            @_connection.removeAllListeners()
            @_connection.destroy()
            @_connection = null

        @trigger "disconnected"
        @off()


    # APIからpostkeyを取得します。
    # @private
    # @param {number} maxRetry 最大取得試行回数
    # @return {Promise} 取得出来た時にpostkeyと共にresolveされ、
    #    失敗した時は、rejectされます。
    _fetchPostKey           : (retry) ->
        self        = @
        dfd         = Promise.defer()
        threadId    = @_live.get("comment").thread
        url         = sprintf NicoUrl.Live.GET_POSTKEY, threadId
        postKey     = ""

        retry = if _.isNumber(retry) then Math.min(Math.abs(retry), 5) else 5

        request.get
            url     : url
            jar     : @_live.getSession().getCookieJar()
            , (err, res, body) ->
                if err?
                    console.error "CommentProvider[%s]: Failed to retrive postKey.", self._live.id

                    if maxRetry is 0
                        dfd.reject "Reached to max retry count."
                        return

                    # ネットにつながってそうなときはリトライする。
                    setTimeout ->
                        self
                            ._fetchPostKey maxRetry - 1
                            .then (key) ->
                                dfd.resolve key
                        , 400

                # 通信成功
                if res.statusCode is 200
                    # 正常に通信できた時
                    postKey = /^postkey=(.*)\s*/.exec body
                    postKey = postKey[1] if postKey?

                if postKey isnt ""
                    # ポストキーがちゃんと取得できれば
                    self._postInfo.postKey = postKey
                    console.info "CommentProvider[%s]: postKey update successful.", self._live.id
                    dfd.resolve postKey
                else
                    console.error "CommentProvider[%s]: Failed to retrive postKey.", self._live.id, arguments
                    dfd.reject()

                return

        return dfd.promise


    # このインスタンスが保持しているNicoLiveInfoオブジェクトを取得します。
    # @return {NicoLiveInfo}
    getLiveInfo             : ->
        return @_live


    # コメントを投稿します。
    # @param {string} msg 投稿するコメント
    # @param {string} command コマンド(184, bigなど)
    # @return {Promise} 投稿に成功すればresolveされ、
    # 失敗すればエラーメッセージとともにrejectされます。
    postComment             : (msg, command) ->
        self        = this
        dfd         = Promise.defer()
        timeoutId   = null
        postInfo    = null
        err         = null

        if typeof msg isnt "string" || msg.replace(/\s/g, "") is ""
            dfd.reject "空コメントは投稿できません。"
            return dfd.promise

        unless @_connection?
            dfd.reject "コメントサーバと接続していません。"
            return dfd.promise

        # PostKeyを取得してコメントを送信
        @_fetchPostKey()
            .then ->
                # 取得成功
                # 送信する情報を集める
                postInfo =
                    userId      : self._live.get("user").id
                    isPremium   : self._live.get("user").isPremium|0

                    comment     : msg
                    command     : command || ""

                    threadId    : self._postInfo.threadId
                    postKey     : self._postInfo.postKey
                    ticket      : self._postInfo.ticket

                # 投稿結果の受信イベントをリスニング
                self.once "_chatresult", (result) ->
                    clearTimeout timeoutId

                    if result.status is CHAT_RESULT.SUCCESS
                        dfd.resolve()
                        return

                    switch result.status
                        when CHAT_RESULT.LOCKED
                            dfd.reject "コメント投稿がロックされています。"
                        else
                            dfd.reject "投稿に失敗しました"

                # 規定時間内に応答がなければタイムアウトとする
                timeoutId = setTimeout ->
                    dfd.reject "タイムアウトしました。"
                , SEND_TIMEOUT

                # コメントを投稿
                console.log "send:", COMMANDS.post(postInfo) + "\0"
                self._connection.write COMMANDS.post(postInfo) + "\0"

            # 通信失敗
            , (err) ->
                dfd.reject err

        return dfd.promise


    # このインスタンスを破棄します。
    dispose                 : ->
        this._live = null
        this._postInfo = null
        this._disconnect()

    # Backbone.Collectionのいくつかのメソッドを無効化
    create                  : _.noop
    fetch                   : _.noop
    sync                    : _.noop


module.exports = CommentProvider
module.exports.ChatResult = _.cloneCHAT_RESULT
