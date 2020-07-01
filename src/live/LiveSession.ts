import _ from "lodash";
import cheerio from "cheerio";
import deepFreeze from "deep-freeze";
import * as Request from "request-promise";
import { Socket } from "net";
import { sprintf } from "sprintf";
import defer, { DeferredPromise } from "p-defer";

import Emitter, { ListenerOf } from "../Emitter";
import NicoSession from "../NicoSession";
import { LiveComment } from "../Entity/LiveComment";
import { LiveMetaData } from "../Entity/LiveMetaData";
import LiveCommentEntity from "../Entity/LiveCommentEntity";
import NicoException from "../NicoException";
import * as NicoUrl from "../NicoURL";

export interface NicoLiveConnectPreference {
  connect: boolean;
  firstGetComments: number;
  timeoutMs: number;
}

interface Events {
  "did-close-connection": [];
  "did-receive-post-result": [{ status: number }];
  "did-receive-data": [string];
  "did-receive-comment": [LiveCommentEntity];
  "did-end-live": [LiveMetaData];
  "_did-receive-connection-response": [];
  "did-error": [Error];
  error: [string];
}

const REGEXP_LT = /</g;
const REGEXP_GT = />/g;

const COMMANDS = {
  connect: _.template(`\
<thread thread="<%- thread %>" version="20061206"
 res_from="-<%- firstGetComments %>"/>\
`),
  post: _.template(`\
<chat thread="<%-threadId%>" ticket="<%-ticket%>"
 postkey="<%-postKey%>" mail="<%-command%>" user_id="<%-userId%>"
 premium="<%-isPremium%>"><%-comment%></chat>\
`),
};

const parseCommentResponse = (
  xml: string,
  sessionUserId: number
): LiveComment => {
  const $xml = cheerio(xml);
  const userId = $xml.attr("user_id");

  return {
    threadId: $xml.attr("thread"),

    date: new Date(+$xml.attr("date") * 1000),
    locale: $xml.attr("locale"),
    command: $xml.attr("mail"),
    comment: $xml.text().replace(REGEXP_GT, ">").replace(REGEXP_LT, "<"),
    vpos: parseInt($xml.attr("vpos"), 10),

    isMyPost:
      $xml.attr("yourpost") === "1" || +$xml.attr("user_id") === sessionUserId,

    user: {
      id: userId,
      score: parseInt($xml.attr("score"), 10),
      accountType: parseInt($xml.attr("premium"), 10),
      isPremium: parseInt($xml.attr("premium"), 10) > 0,
      isAnonymous: parseInt($xml.attr("anonymity"), 10) === 1,
    },
  };
};

const chatResults = deepFreeze({
  SUCCESS: 0,
  CONTINUOUS_POST: 1,
  THREAD_ID_ERROR: 2,
  TICKET_ERROR: 3,
  DIFFERENT_POSTKEY: 4,
  _DIFFERENT_POSTKEY: 8,
  LOCKED: 5,
});

/**
 * 放送中の番組のコメントの取得と投稿を行うクラスです。
 * @class LiveSession
 */
export default class LiveSession extends Emitter<Events> {
  public static CharResult = chatResults;

  public disposed: boolean;

  private _firstResponseWaiter: DeferredPromise<LiveCommentEntity[]>;

  private _socket: Socket | null = null;
  private _postInfo: {
    ticket: string | null;
    postKey: string | null;
    threadId: string | null;
  } = {
    ticket: null,
    postKey: null,
    threadId: null,
  };

  constructor(private _session: NicoSession, private _live: LiveMetaData) {
    super();
    this._firstResponseWaiter = defer();
  }

  /**
   * @private
   * @method _canContinue
   */
  private _canContinue() {
    if (this.disposed) {
      throw new Error("LiveSession has been disposed");
    }
  }

  /**
   * APIからpostkeyを取得します。
   * @private
   * @method _ferchPostKey
   * @return {Promise}
   */
  private async _fetchPostKey() {
    this._canContinue();

    const threadId = this._live.get("comment.thread");
    const url = sprintf(NicoUrl.Live.GET_POSTKEY, threadId);
    let postKey = "";

    const res = await Request.get({
      resolveWithFullResponse: true,
      url,
      jar: this._session.cookie,
    });

    if (res.statusCode === 200) {
      // 正常に通信できた時
      let postKeyToken = /^postkey=(.*)\s*/.exec(res.body);
      if (postKeyToken != null) {
        postKey = postKeyToken[1];
      }
    }

    if (postKey !== "") {
      // ポストキーがちゃんと取得できれば
      this._postInfo.postKey = postKey;
      return postKey;
    } else {
      throw new NicoException({ message: "Failed to fetch post key" });
    }
  }

  /**
   * このインスタンスが保持しているLiveMetaDataオブジェクトを取得します。
   * @method getLiveInfo
   * @return {LiveMetaData}
   */
  public getLiveInfo() {
    return this._live;
  }

  /**
   * コメントサーバーへ接続します。
   *
   * 既に接続済みの場合は接続を行いません。
   * 再接続する場合は `LiveSession#reconnect`を利用してください。
   *
   * @method connect
   * @fires LiveSession#did-connect
   * @param {Object} [options]
   * @param {Number} [options.firstGetComments=100] 接続時に取得するコメント数
   * @param {Number} [options.timeoutMs=5000] タイムアウトまでのミリ秒
   * @return {Promise}
   */
  public async connect(
    options: Partial<NicoLiveConnectPreference> = {}
  ): Promise<void> {
    this._canContinue();

    if (this._socket != null) return;

    const serverInfo = this._live.comment;
    const _options = _.defaults({}, options, {
      firstGetComments: 100,
      timeoutMs: 5000,
    });

    const sock = (this._socket = new Socket());
    sock
      .on("data", this._didReceiveData)
      .on("error", this._didErrorOnSocket)
      .on("close", this._didCloseSocket);

    await Promise.race([
      // Connected
      new Promise<this>((resolve, reject) => {
        this._socket!.connect(serverInfo.port, serverInfo.addr, () => {
          this.once("_did-receive-connection-response", () => {
            // Wait `pong` server response
            resolve(this);
          });

          // Send thread information
          const params = _.assign(
            {},
            { firstGetComments: _options.firstGetComments },
            serverInfo
          );
          this._socket!.write(COMMANDS.connect(params) + "\0");
        });
      }),

      // Connection timeout
      new Promise<this>((_, reject) => {
        setTimeout(() => {
          reject(
            new NicoException({
              message: `[LiveSession: ${this._live.stream.liveId}] Connection timed out.`,
            })
          );
        }, _options.timeoutMs);
      }),
    ]);
  }

  /**
   * @method reconnect
   * @param {Object} options 接続設定（connectメソッドと同じ）
   * @return {Promise}
   */
  public async reconnect(
    options: Partial<NicoLiveConnectPreference>
  ): Promise<void> {
    this._canContinue();

    if (this._socket != null) {
      this._socket.destroy();
    }

    this._socket = null;
    return this.connect();
  } //

  /**
   * コメントサーバから切断します。
   * @method disconnect
   * @fires LiveSession#did-disconnect
   */ public disconnect() {
    this._canContinue();

    if (this._socket == null) {
      return;
    }

    this._socket.removeAllListeners();
    this._socket.destroy();
    this._socket = null;
    this.emit("did-close-connection");
  }

  /**
   * コメントを投稿します。
   * @method postComment
   * @param {String} msg 投稿するコメント
   * @param {String|Array.<String>} [command] コマンド(184, bigなど)
   * @param {Number} [timeoutMs]
   * @return {Promise}
   */
  public async postComment(
    msg: string,
    command?: string | string[],
    timeoutMs?: number
  ) {
    this._canContinue();

    if (command == null) {
      command = "";
    }
    if (timeoutMs == null) {
      timeoutMs = 3000;
    }

    if (typeof msg !== "string" || msg.replace(/\s/g, "") === "") {
      throw new Error("Can not post empty comment");
    }

    if (this._socket == null) {
      throw new Error("No connected to the comment server.");
    }

    if (Array.isArray(command)) {
      command = command.join(" ");
    }

    await this._fetchPostKey();

    const postInfo = {
      userId: this._live.get("user.id"),
      isPremium: this._live.get("user.isPremium") | 0,

      comment: msg,
      command,

      threadId: this._postInfo.threadId,
      postKey: this._postInfo.postKey,
      ticket: this._postInfo.ticket,
    };

    await Promise.race([
      new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new NicoException({
                message: "Post result response is timed out.",
              })
            ),
          timeoutMs
        );
        this._socket!.write(COMMANDS.post(postInfo) + "\0");
      }),
      new Promise((resolve, reject) => {
        const disposer = this._onDidReceivePostResult(({ status }) => {
          disposer.dispose();

          this._socket!.write(COMMANDS.post(postInfo) + "\0");

          switch (status) {
            case chatResults.SUCCESS:
              break;

            case chatResults.THREAD_ID_ERROR:
              throw new NicoException({
                message: "Failed to post comment. (reason: thread id error)",
                code: status,
              });

            case chatResults.TICKET_ERROR:
              throw new NicoException({
                message: "Failed to post comment. (reason: ticket error)",
                code: status,
              });

            case chatResults.DIFFERENT_POSTKEY:
            case chatResults._DIFFERENT_POSTKEY:
              throw new NicoException({
                message:
                  "Failed to post comment. (reason: postkey is defferent)",
                code: status,
              });

            case chatResults.LOCKED:
              throw new NicoException({
                message: "Your posting has been locked.",
                code: status,
              });

            case chatResults.CONTINUOUS_POST:
              throw new NicoException({
                message: "Can not post continuous the same comment.",
                code: status,
              });

            default:
              throw new NicoException({
                message: `Failed to post comment. (status: ${status})`,
                code: status,
              });
          }
        });
      }),
    ]);
  }

  /** インスタンスを破棄します。 */
  public dispose() {
    this._live = null as any;
    this._postInfo = null as any;
    this.disconnect();
    super.dispose();
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
  private _didReceiveData = (xml: string) => {
    this.emit("did-receive-data", xml);

    const comments: LiveCommentEntity[] = [];

    const $elements = cheerio.load(xml)(":root");
    $elements.each((i, element) => {
      const $element = cheerio(element);

      switch (element.name) {
        case "thread": {
          // Did receive first connection response
          this._postInfo.ticket = $element.attr("ticket");
          this.emit("_did-receive-connection-response");
          break;
          // console.info "LiveSession[%s]: Receive thread info", @_live.get("id")
        }

        case "chat": {
          const comment = parseCommentResponse(
            $element.toString(),
            this._live.user.id
          );
          const commentEntity = new LiveCommentEntity(comment);
          comments.push(commentEntity);
          this.emit("did-receive-comment", commentEntity);

          // 配信終了通知が来たら切断
          if (
            commentEntity.isPostByDistributor() &&
            commentEntity.comment === "/disconnect"
          ) {
            this.emit("did-end-live", this._live);
            this.disconnect();
          }

          break;
        }

        case "chat_result": {
          // Did receive post result
          let status = +$element.attr("status");

          const comment = parseCommentResponse(
            $element.find("chat").toString(),
            this._live.user.id
          );
          const commentEntity = new LiveCommentEntity(comment);
          this.emit("did-receive-post-result", { status });
          this.emit("did-receive-comment", commentEntity);
          break;
        }
      }
    });

    this._firstResponseWaiter.resolve!(comments);
  };

  /**
   * コネクション上のエラー処理
   * @private
   * @method _didErrorOnSocket
   */
  private _didErrorOnSocket = (error: string) => {
    this.emit("did-error", new Error(error));
  };

  /**
   * コネクションが閉じられた時の処理
   * @private
   * @method _didCloseSocket
   */
  private _didCloseSocket = (hadError: boolean) => {
    if (hadError) {
      this.emit("error", "Connection closing error (unknown)");
    }

    this.emit("did-close-connection");
  };

  /**
   * コメントサーバのスレッドID変更を監視するリスナ
   * @private
   * @method _didRefreshLiveInfo
   */
  // private _didRefreshLiveInfo() {
  //     // 時々threadIdが変わるのでその変化を監視
  //     this._postInfo.threadId = this._live.get("comment").thread;
  // }

  //
  // Event Handlers
  //

  /**
   * @private
   * @event LiveSession#did-receive-post-result
   * @param {Number} status
   */
  /**
   * @private
   * @method _onDidReceivePostResult
   * @param {Function} listener
   * @return {Disposable}
   */
  private _onDidReceivePostResult(
    listener: ListenerOf<Events["did-receive-post-result"]>
  ) {
    return this.on("did-receive-post-result", listener);
  }

  /**
   * Fire on received and processed thread info and comments first
   * @event LiveSession#did-process-first-response
   * @param {Array.<LiveCommentEntity[]>}
   */
  /**
   * @method onDidProcessFirstResponse
   * @param {Function} listener
   */
  public onDidProcessFirstResponse(
    listener: (comments: LiveCommentEntity[]) => void
  ): void {
    this._firstResponseWaiter.promise.then(listener);
  }

  public onDidReceiveData(listener: ListenerOf<Events["did-receive-data"]>) {
    return this.on("did-receive-data", listener);
  }

  public onDidReceiveComment(
    listener: ListenerOf<Events["did-receive-comment"]>
  ) {
    return this.on("did-receive-comment", listener);
  }

  public onDidError(listener: ListenerOf<Events["did-error"]>) {
    return this.on("did-error", listener);
  }

  public onDidCloseConnection(
    listener: ListenerOf<Events["did-close-connection"]>
  ) {
    return this.on("did-close-connection", listener);
  }

  public onDidEndLive(listener: ListenerOf<Events["did-end-live"]>) {
    return this.on("did-end-live", listener);
  }
}
