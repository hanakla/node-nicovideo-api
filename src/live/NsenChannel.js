/**
 * @class NsenChannel
 */

import _ from "lodash";
import Emitter from "disposable-emitter";
import Cheerio from "cheerio";
import deepFreeze from "deep-freeze";
import { CompositeDisposable, Disposable } from "event-kit";
import QueryString from "querystring";

import APIEndpoints from "../APIEndpoints";
import NicoLiveInfo from "./NicoLiveInfo";
import NsenChannels from "./NsenChannels";

import {
    NicoException,
    NsenSkipRequestDuplecation,
} from "../errors/";

export default class NsenChannel extends Emitter {

    /**
     * Nsenリクエスト時のエラーコード
     * @const {Object.<String, String>
     */
    static RequestError   = deepFreeze({
        NO_LOGIN : "not_login",
        CLOSED : "nsen_close",
        REQUIRED_TAG : "nsen_tag",
        TOO_LONG : "nsen_long",
        REQUESTED : "nsen_requested"
    });

    // "ログインしていません。"
    // "現在リクエストを受け付けていません。"
    // "リクエストに必要なタグが登録されていません。"
    // "動画が長過ぎます。"
    // "リクエストされたばかりです。"

    static Gage  = deepFreeze({
        BLUE : 0,
        GREEN : 1,
        YELLOW : 2,
        ORANGE : 3,
        RED : 4
    });


    static Channels        = NsenChannels;


    /**
     * @param {Object} [options]
     * @param {Boolean} [options.connect=false] NsenChannel生成時にコメントサーバーへ自動接続するか指定します。
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @param {NicoSession}
     * @return {Promise}
     */
    static instanceFor(live, options = {}, session) {
        _.defaults(options, {connect: false});

        let nsen = new NsenChannel(live, session);
        return nsen._attachLive(live).then(function() {
            if (!options.connect) {
                return Promise.resolve(nsen);
            }

            return nsen.connect(options).then(() => Promise.resolve(nsen));
        });
    }


    /**
     * @private
     * @property {NicoLiveInfo} _live
     */
    _live            = null;

    /**
     * @private
     * @property {CommentProvider} _commentProvider
     */
    _commentProvider  = null;

    /**
     * @private
     * @property {NicoSession} _session
     */
    _session          = null;

    /**
     * 再生中の動画情報
     * @private
     * @property {NicoLiveInfo} _playingMovie
     */
    _playingMovie    = null;

    /**
     * @private
     * @property {Number}
     */
    _movieChangeDetectionTimer  = null;

    /**
     * 最後にリクエストした動画情報
     * @private
     * @property {NicoVideoInfo} _requestedMovie
     */
    _requestedMovie  = null;

    /**
     * 最後にスキップした動画のID。
     * 比較用なので動画IDだけ。
     * @private
     * @property {String} _lastSkippedMovieId
     */
    _lastSkippedMovieId  = null;

    /**
     * （午前４時遷移時の）移動先の配信のID
     * @property {String} _nextLiveId
     */
    _nextLiveId      = null;


    /**
     * @param {NicoLiveInfo} liveInfo
     * @param {NicoSession} _session
     */
    constructor(liveInfo, _session) {
        super();

        this._session = _session;
        if (!(liveInfo instanceof NicoLiveInfo)) {
            throw new TypeError("Passed object not instance of NicoLiveInfo.");
        }

        if (liveInfo.isNsenLive() === false) {
            throw new TypeError("This live is not Nsen live streaming.");
        }

        Object.defineProperties(this, {
            id  : {
                get() { return this.getChannelType(); }
            }
        }
        );

        this.onDidChangeMovie(this._didChangeMovie);
        this.onWillClose(this._willClose);
    }


    /**
     * @return {Promise}
     */
    _attachLive(liveInfo) {
        __guard__(this._channelSubscriptions, x => x.dispose());
        this._live = null;
        this._commentProvider = null;

        let sub = this._channelSubscriptions = new CompositeDisposable();
        this._live = liveInfo;

        sub.add(liveInfo.onDidRefresh(() => {
            return this._didLiveInfoUpdated();
        }
        )
        );

        return this.fetch();
    }

    /**
     * チャンネルの種類を取得します。
     * @return {String} "vocaloid", "toho"など
     */
    getChannelType() {
        return this._live.get("stream.nsenType");
    }


    /**
     * 現在接続中の放送のNicoLiveInfoオブジェクトを取得します。
     * @return {NicoLiveInfo}
     */
    getLiveInfo() {
        return this._live;
    }


    /**
     * 現在利用しているCommentProviderインスタンスを取得します。
     * @return {CommentProvider?}
     */
    commentProvider() {
        return this._commentProvider;
    }


    /**
     * 現在再生中の動画情報を取得します。
     * @return {NicoVideoInfo?}
     */
    getCurrentVideo() {
        return this._playingMovie;
    }


    /**
     * @return {NicoVideoInfo?}
     */
    getRequestedMovie() {
        return this._requestedMovie;
    }


    /**
     * スキップリクエストを送信可能か確認します。
     * 基本的には、sendSkipイベント、skipAvailableイベントで
     * 状態の変更を確認するようにします。
     * @return {boolean
     */
    isSkipRequestable() {
        let video = this.getCurrentVideo();
        return (video !== null) && (this._lastSkippedMovieId !== video.id);
    }


    /**
     * @private
     * @param {String} command NicoLive command with "/" prefix
     * @param {Array.<String>} params command params
     */
    _processLiveCommands(command, params = [], options = {}) {
        switch (command) {
            case "/prepare": (() => {
                let [videoId] = params;
                this._willMovieChange(videoId);
            })();
            break;

            case "/play": (() => {
                if (options.ignoreVideoChanged) {
                    return;
                }

                let [source, /* view, title */] = params;
                let videoId = /smile:((?:sm|nm)[1-9][0-9]*)/.exec(source);

                // TODO: remove __guard__
                if (__guard__(videoId, x => x[1]) != null) {
                    this._didDetectMovieChange(videoId[1]);
                }
            })();
            break;

            case "/reset": (() => {
                let [nextLiveId] = params;
                this._nextLiveId = nextLiveId;
                this.emit("will-close", nextLiveId);
            })();
            break;

            case "/nspanel": (() => {
                let [operation, entity] = params;
                this._processNspanelCommand(operation, entity);
            })();
            break;

            case "/nsenrequest": (() => {
                let [state] = params; // "on", "lot"
                this.emit("did-receive-request-state", state);
            })();
            break;
        }
    }


    /**
     * Processing /nspanel command
     * @private
     * @param {String} op
     * @param {String} entity
     */
    _processNspanelCommand(op, entity) {
        if (op !== "show") { return; }

        let panelState = QueryString.parse(entity);

        switch (true) {
            case (panelState.goodClick != null):
                this.emit("did-receive-good");
                return;

            case (panelState.mylistClick != null):
                this.emit("did-receive-add-mylist");
                return;
        }

        if (panelState.dj != null) {
            this.emit("did-receive-tvchan-message", panelState.dj);
            return;
        }

        this.emit("did-change-panel-state", {
            goodBtn     : panelState.goodBtn === "1",
            mylistBtn   : panelState.mylistBtn === "1",
            skipBtn     : panelState.skipBtn === "1",
            title       : panelState.title,
            view        : panelState.view | 0,
            comment     : panelState.comment | 0,
            mylist      : panelState.mylist | 0,
            uploadDate  : new Date(panelState.date),
            playlistLen : panelState.playlistLen | 0,
            corner      : panelState.corner !== "0",
            gage        : panelState.gage | 0,
            tv          : panelState.tv | 0
        });
    }


    /**
     * サーバー側の情報とインスタンスの情報を同期します。
     * @return {Promise}
     */
    async fetch() {
        if (this._live == null) {
            throw new NicoException({
                message: "LiveInfo not attached."
            });
        }

        // リクエストした動画の情報を取得
        let {liveId} = this._live.get("stream");

        let response;
        try {
            await this._live.fetch()
            response = await APIEndpoints.Nsen.syncRequest(this._session, {liveId});
        } catch (e) {
            throw new NicoException({
                message     : `Failed to fetch Nsen request status. (${e.message})`,
                previous    : e
            });
        }

        const $res = Cheerio.load(response.body)(":root");
        const status = $res.attr("status");
        const errorCode = $res.find("error code").text();

        // It's correctry.
        // NsenRequest API returns `[status="fail]"` and `error>code="unknown"`
        // When nothing is requested.
        if (status !== "ok" && errorCode !== "unknown") {
            throw new NicoException({
                message     : `Failed to fetch Nsen request status. (${errorCode})`,
                code        : errorCode,
                response    : response.body
            });
        }

        if (errorCode === "unknown" && this._requestedMovie != null) {
            this._requestedMovie = null;
            this.emit("did-cancel-request");
            return ;
        }

        // リクエストの取得に成功したら動画情報を同期
        const videoId = $res.find("id").text();
        if (videoId.length === 0) {
            return;
        }

        // 直前にリクエストした動画と内容が異なれば
        // 新しい動画に更新
        if (this._requestedMovie != null && this._requestedMovie.id === videoId) {
            return;
        }

        const movie = await this._session.video.getVideoInfo(videoId);
        if (movie == null) {
            return;
        }

        this._requestedMovie = movie;
        this.emit("did-send-request", movie);
    }

    /**
     * コメントサーバーへ接続します。
     *
     * @param {Object} [options]
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @return {Promise}
     */
    async connect(options = {}) {
        _.assign(options, {connect: false});

        const provider = this._commentProvider = await this._live.commentProvider(options);

        const sub = this._channelSubscriptions;
        sub.add(provider.onDidProcessFirstResponse(comments => {
            this.lockAutoEmit("did-process-first-response", comments);
            comments.forEach(comment => this._didCommentReceived(comment));

            sub.add(new Disposable(() => this.unlockAutoEmit("did-process-first-response")));
            sub.add(provider.onDidReceiveComment(comment => this._didCommentReceived(comment)));
        }));

        sub.add(provider.onDidEndLive(() => this._onLiveClosed()));

        return await provider.connect(options);
    }



    /**
     * コメントサーバーに再接続します。
     */
    async reconnect() {
        return await this._commentProvider.reconnect();
    }


    dispose() {
        this.emit("will-dispose");
        this._live = null;
        this._commentProvider = null;
        this._channelSubscriptions.dispose();
        super.dispose();
    }



    //
    // Nsen control methods
    //

    /**
     * リクエストを送信します。
     * @param {NicoVideoInfo|String} movie リクエストする動画の動画IDかNicoVideoInfoオブジェクト
     * @return {Promise}
     */
    async pushRequest(movie) {
        const requestingMovie = typeof movie === 'string'
            ? await this._session.video.getVideoInfo(movie)
            : movie;

        const movieId = requestingMovie.id;
        const liveId = this._live.get('stream.liveId');
        const [res, requestedMovie] = await Promise.all([
            APIEndpoints.Nsen.request(this._session, {liveId, movieId}),
            requestingMovie
        ]);

        const $res = Cheerio.load(res.body)(':root');

        if ($res.attr('status') !== 'ok') {
            throw new NicoException({
                message     : 'Failed to push request',
                code        : $res.find('error code').text(),
                response    : res
            });
        }

        this._requestedMovie = requestedMovie;
        this.emit('did-send-request', requestedMovie);
    }


    /**
     * リクエストをキャンセルします
     * @return {Promise}
     *   キャンセルに成功すればresolveされます。
     *   (事前にリクエストが送信されていない場合もresolveされます。）
     *   リクエストに失敗した時、エラーメッセージつきでrejectされます。
     */
    async cancelRequest() {
        if (!this._requestedMovie) {
            return Promise.resolve();
        }

        const {liveId} = this._live.get("stream");

        const response = await APIEndpoints.Nsen.cancelRequest(this._session, {liveId});
        const $res = Cheerio.load(response.body)(":root");

        if ($res.attr("status") !== "ok") {
            throw new NicoException({
                message     : "Failed to cancel request",
                code        : $res.find("error code").text(),
                response    : response,
            });
        }

        this.emit("did-cancel-request", this._requestedMovie);
        this._requestedMovie = null;
    }


    /**
     * Goodを送信します。
     * @return {Promise}
     *   成功したらresolveされます。
     *   失敗した時、エラーメッセージつきでrejectされます。
     */
    async pushGood() {
        const {liveId} = this._live.get("stream");

        const response = await APIEndpoints.Nsen.sendGood(this._session, {liveId})
        let $res = Cheerio.load(response.body)(":root");

        if ($res.attr("status") !== "ok") {
            throw new NicoException({
                message     : "Failed to push good",
                code        : $res.find("error code").text(),
                response    : response,
            });
        }

        this.emit("did-push-good");
    }



    /**
     * SkipRequestを送信します。
     * @return {Promise}
     *   成功したらresolveされます。
     *   失敗した時、エラーメッセージつきでrejectされます。
     */
    async pushSkip() {
        const {liveId} = this._live.get('stream');
        const movie = this.getCurrentVideo();
        const movieId = movie ? movie.id : undefined;

        if (!this.isSkipRequestable()) {
            throw new NsenSkipRequestDuplecation({
                message: 'Skip request already sended.',
            });
        }

        const res = await APIEndpoints.Nsen.sendSkip(this._session, {liveId})
        const $res = Cheerio.load(res.body).find(':root');

        if ($res.attr('status') !== 'ok') {
            throw new NicoException({
                message     : 'Failed to push skip',
                code        : $res.find('error code').text(),
                response    : res.body
            });
        }

        this._lastSkippedMovieId = movieId;
        this.emit('did-push-skip');
    }


    /**
     * コメントを投稿します。
     * @param {String} msg 投稿するコメント
     * @param {String|Array.<String>} [command] コマンド(184, bigなど)
     * @param {Number} [timeoutMs]
     * @return {Promise} 投稿に成功すればresolveされ、
     *   失敗すればエラーメッセージとともにrejectされます。
     */
    postComment(msg, command = "", timeoutMs = 3000) {
        return __guard__(this._commentProvider, x => x.postComment(msg, command, timeoutMs));
    }


    /**
     * 次のチャンネル情報を受信していれば、その配信へ移動します。
     * @param {Object} [options]
     * @param {Boolean} [options.connect=true] コメントサーバーへ自動接続するか指定します。
     * @return {Promise}
     *   移動に成功すればresolveされ、それ以外の時にはrejectされます。
     */
    async moveToNextLive(options = {}) {
        if (this._nextLiveId == null) { return Promise.reject(); }

        _.defaults(options, {connect: true});

        // 放送情報を取得
        const liveInfo = await this._session.live.getLiveInfo(this._nextLiveId)
        this._attachLive(liveInfo, options);
        this.emit("did-change-stream", liveInfo);
        return await this.fetch();
    }



    //
    // Event Listeners
    //

    /**
     * コメントを受信した時のイベントリスナ。
     *
     * 制御コメントの中からNsen内イベントを通知するコメントを取得して
     * 関係するイベントを発火させます。
     * @param {LiveComment} comment
     */
    _didCommentReceived(comment, options = {ignoreVideoChanged : false}) {
        if (comment.isControlComment() || comment.isPostByDistributor()) {
            let [command, ...params] = comment.comment.split(" ");
            this._processLiveCommands(command, params, options);
        }

        this.emit("did-receive-comment", comment);
    }


    /**
     * 配信情報が更新された時に実行される
     * 再生中の動画などのデータを取得する
     * @param {NicoLiveInfo} live
     */
    _didLiveInfoUpdated() {
        let content = __guard__(this._live.get("stream").contents[0], x => x.content);
        let videoId = content && content.match(/^smile:((?:sm|nm)[1-9][0-9]*)/);

        if (__guard__(videoId, x1 => x1[1]) == null) {
           this._didDetectMovieChange(null);
           return;
       }

        if (((this._playingMovie == null)) || this._playingMovie.id !== videoId) {
            return this._didDetectMovieChange(videoId[1]);
        }
    }

    _willMovieChange(videoId) {
        return this._session.video.getVideoInfo(videoId).then(video => {
            this.emit("will-change-movie", video);
        }
        );
    }


    /**
     * 再生中の動画の変更を検知した時に呼ばれるメソッド
     * @private
     * @param {String} videoId 次に再生される動画のID
     */
    _didDetectMovieChange(videoId) {
        if (this._movieChangeDetectionTimer != null) {
            clearTimeout(this._movieChangeDetectionTimer);
            this._movieChangeDetectionTimer = null;
        }

        this._movieChangeDetectionTimer = setTimeout(() => {
            let beforeVideo = this._playingMovie;

            if (videoId == null) {
                this.emit("did-change-movie", null, beforeVideo);
                this._playingMovie = null;
                return;
            }

            if (__guard__(beforeVideo, x => x.id) === videoId) { return; }

            return this._session.video.getVideoInfo(videoId).then(video => {
                this._playingMovie = video;
                this.emit("did-change-movie", video, beforeVideo);
            }
            );
        }
        , 1000);

    }


    /**
     * チャンネルの内部放送IDの変更を検知するリスナ
     * @param {String} nextLiveId
     */
    _willClose(nextLiveId) {
        return this._nextLiveId = nextLiveId;
    }


    /**
     * 放送が終了した時のイベントリスナ
     */
    _onLiveClosed() {
        this.emit("ended");

        // 放送情報を差し替え
        return this.moveToNextLive();
    }


    /**
     * 再生中の動画が変わった時のイベントリスナ
     */
    _didChangeMovie() {
        this._lastSkippedMovieId = null;
        return this.emit("did-available-skip");
    }




    //
    // Event Handlers
    //

    /**
     * @event NsenChannel#did-process-first-response
     * @param {Array.<NicoLiveComment>}
     */
    onDidProcessFirstResponse(listener) {
        return this.on("did-process-first-response", listener);
    }

    /**
     * @event NsenChannel#did-receive-comment
     * @param {NicoLiveComment} comment
     */
    onDidReceiveComment(listener) {
        return this.on("did-receive-comment", listener);
    }


    /**
     * @event NsenChannel#did-receive-good
     */
    onDidReceiveGood(listener) {
        return this.on("did-receive-good", listener);
    }


    /**
     * @event NsenChannel#did-receive-add-mylist
     */
    onDidReceiveAddMylist(listener) {
        return this.on("did-receive-add-mylist", listener);
    }


    /**
     * @event NsenChannel#did-push-good
     */
    onDidPushGood(listener) {
        return this.on("did-push-good", listener);
    }


    /**
     * @event NsenChannel#did-push-skip
     */
    onDidPushSkip(listener) {
        return this.on("did-push-skip", listener);
    }


    /**
     * @event NsenChannel#did-send-request
     * @param {NicoVideoInfo} movie
     */
    onDidSendRequest(listener) {
        return this.on("did-send-request", listener);
    }


    /**
     * @event NsenChannel#did-cancel-request
     * @param {NicoVideoInfo}
     */
    onDidCancelRequest(listener) {
        return this.on("did-cancel-request", listener);
    }

    /**
     * @event NsenChannel#will-change-movie
     * @param {NicoVideoInfo} movie
     */
    onWillChangeMovie(listener) {
        return this.on("will-change-movie", listener);
    }

    /**
     * @event NsenChannel#did-change-movie
     * @param {NicoVideoInfo} nextMovie
     * @param {NicoVideoInfo} beforeMovie
     */
    onDidChangeMovie(listener) {
        return this.on("did-change-movie", listener);
    }


    /**
     * @event NsenChannel#did-available-skip
     */
    onDidAvailableSkip(listener) {
        return this.on("did-available-skip", listener);
    }


    /**
     * @event NsenChannel#will-close
     * @param {String} nextLiveId
     */
    onWillClose(listener) {
        return this.on("will-close", listener);
    }


    /**
     * @event NsenChannel#did-receive-request-state
     * @param {String} newState
     */
    onDidReceiveRequestState(listener) {
        return this.on("did-receive-request-state", listener);
    }

    /**
     * @event NsenChannel#did-change-panel-state
     * @property {Boolean} goodBtn
     * @property {Boolean} mylistBtn
     * @property {Boolean} skipBtn
     * @property {String} title
     * @property {Number} view
     * @property {Number} comment
     * @property {Number} mylist
     * @property {Date} uploadDate
     * @property {Number} playlistLen
     * @property {Boolean} corner
     * @property {Number} gage
     * @property {Number} tv
     */
    onDidChangePanelState(listener) {
        return this.on("did-change-panel-state", listener);
    }


    /**
     * @event NsenChannel#did-receive-tvchan-message
     * @param {String} message
     */
    onDidReceiveTvchanMessage(listener) {
        return this.on("did-receive-tvchan-message", listener);
    }

    /**
     * @event NsenChannel#will-dispose
     */
    onWillDispose(listener) {
        return this.on("will-dispose", listener);
    }
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
