###*
# 放送中の番組のコメントの取得と投稿を行うクラスです。
# @class CommentProvider
###

_ = require "lodash"
Cheerio = require "cheerio"
deepFreeze = require "deep-freeze"
Request = require "request-promise"
Deferred = require "promise-native-deferred"
{Socket} = require "net"
{sprintf} = require "sprintf"

Emitter = require "disposable-emitter"
NicoUrl     = require "../NicoURL"
NicoException = require "../NicoException"
NicoLiveComment = require "./NicoLiveComment"


chatResults = deepFreeze
    SUCCESS             : 0
    CONTINUOUS_POST     : 1
    THREAD_ID_ERROR     : 2
    TICKET_ERROR        : 3
    DIFFERENT_POSTKEY   : 4
    _DIFFERENT_POSTKEY  : 8
    LOCKED              : 5


COMMANDS =
    connect : _.template """
        <thread thread="<%- thread %>" version="20061206"
         res_from="-<%- firstGetComments %>"/>
    """
    post    : _.template """
        <chat thread="<%-threadId%>" ticket="<%-ticket%>"
         postkey="<%-postKey%>" mail="<%-command%>" user_id="<%-userId%>"
         premium="<%-isPremium%>"><%-comment%></chat>
    """

module.exports =
class CommentProvider extends Emitter
    @ChatResult : chatResults

    ###*
    # @param {NicoLiveInfo} liveInfo
    # @return {Promise}
    ###
    @instanceFor : (liveInfo) ->
        unless liveInfo?
            throw new TypeError("liveInfo must be instance of NicoLiveInfo")

        Promise.resolve new CommentProvider(liveInfo)

    ###*
    # @private
    # @propery {NicoLiveInfo} _live
    ###
    _live       : null

    ###*
    # @private
    # @propery {net.Socket} _socket
    ###
    _socket : null

    ###*
    # @private
    # @propery {Object} _postInfo
    ###
    _postInfo   : null
        # ticket      : null
        # postKey     : null
        # threadId    : null

    ###*
    # @property {Boolean} isFirstResponseProsessed
    ###
    isFirstResponseProsessed : false

    ###*
    # @constructor
    # @param {NicoLiveInfo} _live
    ###
    constructor : (@_live) ->
        super

        @isFirstResponseProsessed = false
        @_postInfo  =
            ticket : null
            postKey : null
            threadId : null


    ###*
    # このインスタンスが保持しているNicoLiveInfoオブジェクトを取得します。
    # @method getLiveInfo
    # @return {NicoLiveInfo}
    ###
    getLiveInfo : ->
        return @_live


    ###*
    # @private
    # @method _canContinue
    ###
    _canContinue : ->
        if @disposed
            throw new Error("CommentProvider has been disposed")
        return


    ###*
    # [Method for testing] Stream given xml data as socket received data.
    # @private
    # @method _pourXMLData
    # @param {String} xml
    ###
    _pourXMLData : (xml) ->
        @_didReceiveData(xml)


    ###*
    # コメントサーバーへ接続します。
    #
    # 既に接続済みの場合は接続を行いません。
    # 再接続する場合は `CommentProvider#reconnect`を利用してください。
    #
    # @method connect
    # @fires CommentProvider#did-connect
    # @param {Object} [options]
    # @param {Number} [options.firstGetComments=100] 接続時に取得するコメント数
    # @param {Number} [options.timeoutMs=5000] タイムアウトまでのミリ秒
    # @return {Promise}
    ###
    connect : (options = {}) ->
        @_canContinue()

        return Promise.resolve(@) if @_socket?

        serverInfo  = @_live.get "comment"
        options = _.defaults {}, options,
            firstGetComments: 100
            timeoutMs : 5000

        new Promise (resolve, reject) =>
            timerId = null
            @_socket = new Socket

            # @once "receive", @_threadInfoDetector

            @_socket
            .once "connect", =>
                @once "_did-receive-connection-response", =>
                    clearTimeout timerId
                    resolve(@)
                    return

                # Send thread information
                params = _.assign({}, {firstGetComments: options.firstGetComments}, serverInfo)
                @_socket.write COMMANDS.connect(params) + '\0'

                return

            .on "data", @_didReceiveData.bind(@)

            .on "error", @_didErrorOnSocket.bind(@)

            .on "close", @_didCloseSocket.bind(@)

            @_socket.connect
                host : serverInfo.addr
                port : serverInfo.port

            timerId = setTimeout =>
                reject new Error("[CommentProvider: #{@_live.id}] Connection timed out.")
                return
            , options.timeoutMs


    ###*
    # @method reconnect
    # @param {Object} options 接続設定（connectメソッドと同じ）
    # @return {Promise}
    ###
    reconnect : (options) ->
        @_canContinue()

        @_socket.destroy() if @_socket?
        @_socket = null
        @connect()


    ###*
    # コメントサーバから切断します。
    # @method disconnect
    # @fires CommentProvider#did-disconnect
    ####
    disconnect : ->
        @_canContinue()

        return unless @_socket?

        @_socket.removeAllListeners()
        @_socket.destroy()
        @_socket = null
        @emit "did-close-connection"
        return


    ###*
    # APIからpostkeyを取得します。
    # @private
    # @method _ferchPostKey
    # @return {Promise}
    ###
    _fetchPostKey : ->
        @_canContinue()

        threadId    = @_live.get("comment.thread")
        url         = sprintf NicoUrl.Live.GET_POSTKEY, threadId
        postKey     = ""

        # retry = if _.isNumber(retry) then Math.min(Math.abs(retry), 5) else 5

        Request.get
            resolveWithFullResponse : true
            url : url
            jar : @_live._session.cookie
        .then (res) =>
            if res.statusCode is 200
                # 正常に通信できた時
                postKey = /^postkey=(.*)\s*/.exec res.body
                postKey = postKey[1] if postKey?

            if postKey isnt ""
                # ポストキーがちゃんと取得できれば
                @_postInfo.postKey = postKey
                Promise.resolve postKey
            else
                Promise.reject new Error("Failed to fetch post key")


    ###*
    # コメントを投稿します。
    # @method postComment
    # @param {String} msg 投稿するコメント
    # @param {String|Array.<String>} [command] コマンド(184, bigなど)
    # @param {Number} [timeoutMs]
    # @return {Promise}
    ###
    postComment : (msg, command = "", timeoutMs = 3000) ->
        @_canContinue()

        if typeof msg isnt "string" || msg.replace(/\s/g, "") is ""
            return Promise.reject new Error("Can not post empty comment")

        unless @_socket?
            return Promise.reject new Error("No connected to the comment server.")

        command = command.join(" ") if Array.isArray(command)

        @_fetchPostKey().then =>
            defer = new Deferred
            timerId = null

            postInfo =
                userId      : @_live.get("user.id")
                isPremium   : @_live.get("user.isPremium")|0

                comment     : msg
                command     : command

                threadId    : @_postInfo.threadId
                postKey     : @_postInfo.postKey
                ticket      : @_postInfo.ticket

            disposer = @_onDidReceivePostResult ({status}) ->
                disposer.dispose()
                clearTimeout timerId

                switch status
                    when chatResults.SUCCESS
                        defer.resolve()

                    when chatResults.THREAD_ID_ERROR
                        defer.reject new NicoException
                            message : "Failed to post comment. (reason: thread id error)"
                            code : status

                    when chatResults.TICKET_ERROR
                        defer.reject new NicoException
                            message : "Failed to post comment. (reason: ticket error)"
                            code : status

                    when chatResults.DIFFERENT_POSTKEY, chatResults._DIFFERENT_POSTKEY
                        defer.reject new NicoException
                            message : "Failed to post comment. (reason: postkey is defferent)"
                            code : status

                    when chatResults.LOCKED
                        defer.reject new NicoException
                            message : "Your posting has been locked."
                            code : status

                    when chatResults.CONTINUOUS_POST
                        defer.reject new NicoException
                            message : "Can not post continuous the same comment."
                            code : status

                    else
                        defer.reject new NicoException
                            message : "Failed to post comment. (status: #{status})"
                            code : status

                return


            timerId = setTimeout ->
                disposer.dispose()
                defer.reject new Error("Post result response is timed out.")
            , timeoutMs

            @_socket.write COMMANDS.post(postInfo) + "\0"

            defer.promise


    ###*
    # インスタンスを破棄します。
    # @method dispose
    ###
    dispose : ->
        @_live = null
        @_postInfo = null
        @disconnect()
        super


    #
    # Event Listeners
    #

    ###*
    # コメント受信処理
    # @private
    # @method _didReceiveData
    # @param {String} xml
    ###
    _didReceiveData : (xml) ->
        @emit "did-receive-data", xml

        comments = []

        $elements = Cheerio.load(xml)(":root")
        $elements.each (i, element) =>
            $element = Cheerio(element)

            switch element.name
                when "thread"
                    # Did receive first connection response
                    @_postInfo.ticket = $element.attr "ticket"
                    @emit "_did-receive-connection-response"
                    # console.info "CommentProvider[%s]: Receive thread info", @_live.get("id")

                when "chat"
                    comment = NicoLiveComment.fromRawXml($element.toString(), @_live.get("user.id"))
                    comments.push comment
                    @emit "did-receive-comment", comment

                    # 配信終了通知が来たら切断
                    if comment.isPostByDistributor() and comment.comment is "/disconnect"
                        @emit "did-end-live", @_live
                        @disconnect()

                when "chat_result"
                    # Did receive post result
                    status = $element.attr "status"
                    status = status | 0

                    comment = NicoLiveComment.fromRawXml($element.find("chat").toString(), @_live.get("user.id"))
                    @emit "did-receive-post-result", {status}
                    @emit "did-receive-comment", comment

            return

        if @isFirstResponseProsessed is no
            @isFirstResponseProsessed = yes
            @lockAutoEmit "did-process-first-response", comments

        return


    ###*
    # コネクション上のエラー処理
    # @private
    # @method _didErrorOnSocket
    ###
    _didErrorOnSocket : (error) ->
        @emit "did-error", error
        return


    ###*
    # コネクションが閉じられた時の処理
    # @private
    # @method _didCloseSocket
    ###
    _didCloseSocket  : (hadError) ->
        if hadError
            @emit "error", "Connection closing error (unknown)"

        @emit "did-close-connection"
        return


    ###*
    # コメントサーバのスレッドID変更を監視するリスナ
    # @private
    # @method _didRefreshLiveInfo
    ###
    _didRefreshLiveInfo : ->
        # 時々threadIdが変わるのでその変化を監視
        @_postInfo.threadId = @_live.get("comment").thread
        return


    #
    # Event Handlers
    #

    ###*
    # @private
    # @event CommentProvider#did-receive-post-result
    # @param {Number} status
    ###
    ###*
    # @private
    # @method _onDidReceivePostResult
    # @param {Function} listener
    # @return {Disposable}
    ###
    _onDidReceivePostResult : (listener) ->
        @on "did-receive-post-result", listener


    ###*
    # Fire on received and processed thread info and comments first
    # @event CommentProvider#did-process-first-response
    # @param {Array.<NicoLiveComment>}
    ###
    ###*
    # @method onDidProcessFirstResponse
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidProcessFirstResponse : (listener) ->
        @on "did-process-first-response", listener


    ###*
    # Fire on raw response received
    # @event CommentProvider#did-receive-data
    # @params {String}  data
    ###
    ###*
    # @method onDidReceiveData
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidReceiveData : (listener) ->
        @on "did-receive-data", listener


    ###*
    # Fire on comment received
    # @event CommentProvider#did-receive-comment
    # @params {NicoLiveComment} comment
    ###
    ###*
    # @method onDidReceiveComment
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidReceiveComment : (listener) ->
        @on "did-receive-comment", listener


    ###*
    # Fire on error raised on Connection
    # @event CommentProvider#did-error
    # @params {Error} error
    ###
    ###*
    # @method onDidError
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidError : (listener) ->
        @on "did-error", listener


    ###*
    # Fire on connection closed
    # @event CommentProvider#did-close-connection
    ###
    ###*
    # @method onDidCloseConnection
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidCloseConnection : (listener) ->
        @on "did-close-connection", listener


    ###*
    # Fire on live  ended
    # @event CommentProvider#did-end-live
    ###
    ###*
    # @method onDidEndLive
    # @param {Function} listener
    # @return {Disposable}
    ###
    onDidEndLive : (listener) ->
        @on "did-end-live", listener
