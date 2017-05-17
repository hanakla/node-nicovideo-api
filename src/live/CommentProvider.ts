import * as _ from 'lodash'
import * as Cheerio from 'cheerio'
import * as deepFreeze from 'deep-freeze'
import * as Request from 'request-promise'
import {Socket} from 'net'
import {sprintf} from 'sprintf'

import Emitter from '../Emitter'
import NicoSession from '../NicoSession'
import NicoLiveInfo from './NicoLiveInfo'
import NicoException from '../NicoException'
import NicoLiveComment from './NicoLiveComment'

export interface NicoLiveConnectPreference {
    connect: boolean
    firstGetComments: number
    timeoutMs: number
}

const COMMANDS = {
    connect : _.template(`\
<thread thread="<%- thread %>" version="20061206"
 res_from="-<%- firstGetComments %>"/>\
`
    ),
    post    : _.template(`\
<chat thread="<%-threadId%>" ticket="<%-ticket%>"
 postkey="<%-postKey%>" mail="<%-command%>" user_id="<%-userId%>"
 premium="<%-isPremium%>"><%-comment%></chat>\
`
    )
};

const chatResults = deepFreeze({
    SUCCESS             : 0,
    CONTINUOUS_POST     : 1,
    THREAD_ID_ERROR     : 2,
    TICKET_ERROR        : 3,
    DIFFERENT_POSTKEY   : 4,
    _DIFFERENT_POSTKEY  : 8,
    LOCKED              : 5
})

/**
 * 放送中の番組のコメントの取得と投稿を行うクラスです。
 * @class CommentProvider
 */
export default class CommentProvider extends Emitter
{
    static CharResult = chatResults

    public static instanceFor(session: NicoSession, liveInfo: NicoLiveInfo)
    {
        if (liveInfo == null) {
            throw new TypeError("liveInfo must be instance of NicoLiveInfo");
        }

        return new CommentProvider(session, liveInfo)
    }

    public disposed: boolean

    private _isFirstResponseProsessed: boolean = false
    private _socket: Socket
    private _postInfo: {
        ticket: string|null,
        postKey: string|null,
        threadId: string|null
    } = {
        ticket : null,
        postKey : null,
        threadId : null
    }

    constructor(
        private _session: NicoSession,
        private _live: NicoLiveInfo
    ) {
        super()
    }


    /**
     * このインスタンスが保持しているNicoLiveInfoオブジェクトを取得します。
     * @method getLiveInfo
     * @return {NicoLiveInfo}
     */
    public getLiveInfo() {
        return this._live;
    }


    /**
     * @private
     * @method _canContinue
     */
    private _canContinue()
    {
        if (this.disposed) {
            throw new Error("CommentProvider has been disposed");
        }
    }

    /**
     * コメントサーバーへ接続します。
     *
     * 既に接続済みの場合は接続を行いません。
     * 再接続する場合は `CommentProvider#reconnect`を利用してください。
     *
     * @method connect
     * @fires CommentProvider#did-connect
     * @param {Object} [options]
     * @param {Number} [options.firstGetComments=100] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs=5000] タイムアウトまでのミリ秒
     * @return {Promise}
     */
    public async connect(options: Partial<NicoLiveConnectPreference> = {}): Promise<this>
    {
        this._canContinue()

        if (this._socket != null) return this

        const serverInfo  = this._live.get('comment')
        const _options = _.defaults({}, options, {
            firstGetComments: 100,
            timeoutMs : 5000
        })

        const sock = this._socket = new Socket
        sock
            .on('data', this._didReceiveData)
            .on('error', this._didErrorOnSocket)
            .on('close', this._didCloseSocket)

        return Promise.race([
            // Connected
            new Promise<this>((resolve, reject) => {
                this._socket!.connect(serverInfo.port, serverInfo.addr, () => {
                    this.once('_did-receive-connection-response', () => {
                        // Wait `pong` server response
                        resolve(this)
                    })

                    // Send thread information
                    const params = _.assign({}, {firstGetComments: _options.firstGetComments}, serverInfo);
                    this._socket!.write(COMMANDS.connect(params) + '\0');
                })
            }),

            // Connection timeout
            new Promise<this>((_, reject) => {
                setTimeout(() => {
                    reject(new NicoException({message: `[CommentProvider: ${this._live.id}] Connection timed out.`}))
                }, _options.timeoutMs)
            })
        ])
    }


    /**
     * @method reconnect
     * @param {Object} options 接続設定（connectメソッドと同じ）
     * @return {Promise}
     */
    public async reconnect(options: Partial<NicoLiveConnectPreference>)
    {
        this._canContinue()

        if (this._socket != null) {
            this._socket.destroy()
        }

        this._socket = null
        return this.connect()
    }


    /**
     * コメントサーバから切断します。
     * @method disconnect
     * @fires CommentProvider#did-disconnect
     *///
    public disconnect() {
        this._canContinue();

        if (this._socket == null) { return; }

        this._socket.removeAllListeners();
        this._socket.destroy();
        this._socket = null;
        this.emit("did-close-connection");
    }


    /**
     * APIからpostkeyを取得します。
     * @private
     * @method _ferchPostKey
     * @return {Promise}
     */
    private async _fetchPostKey()
    {
        this._canContinue()

        const threadId = this._live.get("comment.thread")
        const url = sprintf(NicoUrl.Live.GET_POSTKEY, threadId)
        let postKey = ''

        const res = await Request.get({
            resolveWithFullResponse : true,
            url,
            jar : this._session.cookie
        })

        if (res.statusCode === 200) {
            // 正常に通信できた時
            let postKeyToken = /^postkey=(.*)\s*/.exec(res.body)
            if (postKeyToken != null) {
                postKey = postKeyToken[1]
            }
        }

        if (postKey !== '') {
            // ポストキーがちゃんと取得できれば
            this._postInfo.postKey = postKey
            return postKey
        } else {
            throw new NicoException({message: 'Failed to fetch post key'})
        }
    }


    /**
     * コメントを投稿します。
     * @method postComment
     * @param {String} msg 投稿するコメント
     * @param {String|Array.<String>} [command] コマンド(184, bigなど)
     * @param {Number} [timeoutMs]
     * @return {Promise}
     */
    public async postComment(msg: string, command?: string|string[], timeoutMs?: number)
    {
        this._canContinue()


        if (command == null) { command = ""; }
        if (timeoutMs == null) { timeoutMs = 3000; }

        if (typeof msg !== "string" || msg.replace(/\s/g, "") === "") {
            throw new Error("Can not post empty comment");
        }

        if (this._socket == null) {
            throw new Error("No connected to the comment server.");
        }

        if (Array.isArray(command)) {
            command = command.join(" ");
        }

        await this._fetchPostKey()

        let timerId = null;

        const postInfo = {
            userId      : this._live.get("user.id"),
            isPremium   : this._live.get("user.isPremium")|0,

            comment     : msg,
            command,

            threadId    : this._postInfo.threadId,
            postKey     : this._postInfo.postKey,
            ticket      : this._postInfo.ticket
        };

        await Promise.race([
            new Promise((_, reject) => {
                setTimeout(() => reject(new NicoException({message: "Post result response is timed out."})), timeoutMs)
                this._socket.write(COMMANDS.post(postInfo) + "\0")
            }),
            new Promise((resolve, reject) => {
                const disposer = this._onDidReceivePostResult(({status}) => {
                disposer.dispose()
                clearTimeout(timerId)
                this._socket.write(COMMANDS.post(postInfo) + "\0")

                switch (status) {
                    case chatResults.SUCCESS:
                        break;

                    case chatResults.THREAD_ID_ERROR:
                        throw new NicoException({
                            message : "Failed to post comment. (reason: thread id error)",
                            code : status
                        })

                    case chatResults.TICKET_ERROR:
                        throw new NicoException({
                            message : "Failed to post comment. (reason: ticket error)",
                            code : status
                        })

                    case chatResults.DIFFERENT_POSTKEY: case chatResults._DIFFERENT_POSTKEY:
                        throw new NicoException({
                            message : "Failed to post comment. (reason: postkey is defferent)",
                            code : status
                        })

                    case chatResults.LOCKED:
                        throw new NicoException({
                            message : "Your posting has been locked.",
                            code : status
                        })

                    case chatResults.CONTINUOUS_POST:
                        throw new NicoException({
                            message : "Can not post continuous the same comment.",
                            code : status
                        })

                    default:
                        throw new NicoException({
                            message : `Failed to post comment. (status: ${status})`,
                            code : status
                        })
                    }
                })
            })
        ])
    }


    /**
     * インスタンスを破棄します。
     * @method dispose
     */
    public dispose()
    {
        this._live = null;
        this._postInfo = null;
        this.disconnect();
        return super.dispose(...arguments);
    }


    //
    // Event Listeners
    //

    /**
     * コメント受信処理
     * @private
     * @method _didReceiveData
     * @param {String} xml
     */
    private _didReceiveData = (xml: string) =>
    {
        this.emit("did-receive-data", xml);

        const comments: NicoLiveComment[] = [];

        const $elements = Cheerio.load(xml)(":root");
        $elements.each((i, element) => {
            const $element = Cheerio(element);

            switch (element.name) {
                case "thread":
                    // Did receive first connection response
                    this._postInfo.ticket = $element.attr("ticket");
                    this.emit("_did-receive-connection-response");
                    break;
                    // console.info "CommentProvider[%s]: Receive thread info", @_live.get("id")

                case "chat":
                    let comment = NicoLiveComment.fromRawXml($element.toString(), this._live.get("user.id"));
                    comments.push(comment);
                    this.emit("did-receive-comment", comment);

                    // 配信終了通知が来たら切断
                    if (comment.isPostByDistributor() && (comment.comment === "/disconnect")) {
                        this.emit("did-end-live", this._live);
                        this.disconnect();
                    }
                    break;

                case "chat_result":
                    // Did receive post result
                    let status = $element.attr("status");
                    status = status | 0;

                    comment = NicoLiveComment.fromRawXml($element.find("chat").toString(), this._live.get("user.id"));
                    this.emit("did-receive-post-result", {status});
                    this.emit("did-receive-comment", comment);
                    break;
            }

        }
        );

        if (this._isFirstResponseProsessed === false) {
            this._isFirstResponseProsessed = true;
            this.lockAutoEmit("did-process-first-response", comments)
        }

    }


    /**
     * コネクション上のエラー処理
     * @private
     * @method _didErrorOnSocket
     */
    private _didErrorOnSocket = (error: string) =>
    {
        this.emit("did-error", error)
    }


    /**
     * コネクションが閉じられた時の処理
     * @private
     * @method _didCloseSocket
     */
    private _didCloseSocket = (hadError: boolean) =>
    {
        if (hadError) {
            this.emit("error", "Connection closing error (unknown)")
        }

        this.emit("did-close-connection")
    }


    /**
     * コメントサーバのスレッドID変更を監視するリスナ
     * @private
     * @method _didRefreshLiveInfo
     */
    private _didRefreshLiveInfo() {
        // 時々threadIdが変わるのでその変化を監視
        this._postInfo.threadId = this._live.get("comment").thread;
    }


    //
    // Event Handlers
    //

    /**
     * @private
     * @event CommentProvider#did-receive-post-result
     * @param {Number} status
     */
    /**
     * @private
     * @method _onDidReceivePostResult
     * @param {Function} listener
     * @return {Disposable}
     */
    private _onDidReceivePostResult(listener: (result: {status: number}) => any)
    {
        return this.on("did-receive-post-result", listener);
    }


    /**
     * Fire on received and processed thread info and comments first
     * @event CommentProvider#did-process-first-response
     * @param {Array.<NicoLiveComment>}
     */
    /**
     * @method onDidProcessFirstResponse
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidProcessFirstResponse(listener) {
        return this.on("did-process-first-response", listener);
    }


    /**
     * Fire on raw response received
     * @event CommentProvider#did-receive-data
     * @params {String}  data
     */
    /**
     * @method onDidReceiveData
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidReceiveData(listener) {
        return this.on("did-receive-data", listener);
    }


    /**
     * Fire on comment received
     * @event CommentProvider#did-receive-comment
     * @params {NicoLiveComment} comment
     */
    /**
     * @method onDidReceiveComment
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidReceiveComment(listener) {
        return this.on("did-receive-comment", listener);
    }


    /**
     * Fire on error raised on Connection
     * @event CommentProvider#did-error
     * @params {Error} error
     */
    /**
     * @method onDidError
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidError(listener) {
        return this.on("did-error", listener);
    }


    /**
     * Fire on connection closed
     * @event CommentProvider#did-close-connection
     */
    /**
     * @method onDidCloseConnection
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidCloseConnection(listener) {
        return this.on("did-close-connection", listener);
    }


    /**
     * Fire on live  ended
     * @event CommentProvider#did-end-live
     */
    /**
     * @method onDidEndLive
     * @param {Function} listener
     * @return {Disposable}
     */
    public onDidEndLive(listener) {
        return this.on("did-end-live", listener);
    }
}
