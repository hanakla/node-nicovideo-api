/*
 * ニコニコ生放送の配信情報
 *
 * Properties
 *   stream:     -- 放送の基礎情報
 *       liveId:         string -- 放送ID
 *       title:          string -- 放送タイトル
 *       description:    string -- 放送の説明
 *
 *       watchCount:     number -- 視聴数
 *       commentCount:   number -- コメント数
 *
 *       baseTime:       Date -- 生放送の時間の関わる計算の"元になる時間"
 *       startTime:      Date -- 放送の開始時刻
 *       openTime:       Date -- 放送の開場時間
 *       endTime:        Date -- 放送の終了時刻（放送中であれば終了予定時刻）
 *
 *       isOfficial:     boolean -- 公式配信か
 *       isNsen:         boolean -- Nsenのチャンネルか
 *       nsenType:       string -- Nsenのチャンネル種別（"nsen/***"の***の部分）
 *
 *       contents:       Array<Object>
 *           id:             string -- メイン画面かサブ画面か
 *           startTime:      number -- 再生開始時間
 *           disableAudio:   boolean -- 音声が無効にされているか
 *           disableVideo:   boolean -- 映像が無効にされているか
 *           duration:       number|null -- 再生されているコンテンツの長さ（秒数）
 *           title:          string|null -- 再生されているコンテンツのタイトル
 *           content:        string -- 再生されているコンテンツのアドレス（動画の場合は"smile:動画ID"）
 *
 *   owner:      -- 配信者の情報
 *       userId:         number -- ユーザーID
 *       name:           string -- ユーザー名
 *
 *   user:       -- 自分自身の情報
 *       id:             number -- ユーザーID
 *       name:           string -- ユーザー名
 *       isPremium:      boolean -- プレミアムアカウントか
 *
 *   rtmp:       -- 配信に関する情報。詳細不明
 *       isFms:          boolean
 *       port:           number
 *       url:            string
 *       ticket:         string
 *
 *   comment:    -- コメントサーバーの情報
 *       addr:           string -- サーバーアドレス
 *       port:           number -- サーバーポート
 *       thread:         number -- この放送と対応するスレッドID
 *
 * @class NicoLiveInfo
 */

import _ from 'lodash'
import __ from 'lodash-deep'
import Cheerio from 'cheerio'
import Request from 'request-promise'
import {sprintf} from 'sprintf'

import APIEndpoints from '../APIEndpoints'
import NicoSession from '../Session'
import {NicoLiveConnectPreference} from './CommentProvider'
import NicoURL from '../NicoURL'
import NicoException from '../NicoException'
import Emitter from '../Emitter'
import CommentProvider from './CommentProvider'

export default class NicoLiveInfo extends Emitter {
    /**
     * マイリストが最新の内容に更新された時に発火します
     * @event MyList#did-refresh
     * @property {NicoLiveInfo}  live
     */

    /**
     * @static
     * @return {Promise}
     */
    static instanceFor(liveId, session) {
        if ((typeof liveId !== "string") || (liveId === "")) {
            throw new TypeError("liveId must bea string")
        }

        const live = new NicoLiveInfo(liveId, session)
        return live.fetch().then(() => Promise.resolve(live))
    }

    defaults = {
        stream      : {
            liveId      : null,
            title       : null,
            description : null,

            watchCount  : -1,
            commentCount: -1,

            baseTime    : null,
            openTime    : null,
            startTime   : null,
            endTime     : null,

            isOfficial  : false,
            isNsen      : false,
            nsenType    : null,

            contents    : {
                //  id:string,
                //  startTime:number,
                //  disableAudio:boolean,
                //  disableVideo:boolean,
                //  duration:number|null,
                //  title:string|null,
                //  content:string
            }
        },

        owner       : {
            userId      : -1,
            name        : null
        },

        user        : {
            id          : -1,
            name        : null,
            isPremium   : null
        },

        rtmp        : {
            isFms       : null,
            port        : null,
            url         : null,
            ticket      : null
        },

        comment     : {
            addr        : null,
            port        : -1,
            thread      : null
        },

        _hasError   : true
    }

    id: string
    private _commentProvider: CommentProvider
    private _session: NicoSession
    private _attr: any

    /**
     * @property {String}    id
     */


    /**
     * @param {string}       liveId  放送ID
     * @param {NicoSession}  session 認証チケット
     */
    constructor(liveId: string, _session: NicoSession)
    {
        super()
        this.id = liveId
        this._session = _session
    }


    /**
     * 公式放送か
     */
    isOfficialLive(): boolean
    {
        return !!this.get("stream").isOfficial
    }


    /**
     * Nsenのチャンネルか
     */
    isNsenLive(): boolean
    {
        return !!this.get("stream").isNsen
    }


    /**
     * 放送が終了しているか
     * @return {boolean}
     */
    isEnded()
    {
        return this.get("isEnded") === true
    }


    /**
     * @param {String}   path
     */
    get(path): any
    {
        return _.get(this._attr, path)
    }


    /**
     * この放送に対応するCommentProviderオブジェクトを取得します。
     * @param {Object} options 接続設定
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @param {Boolean} [options.connect] trueを指定するとコネクション確立後にresolveします
     * @return {Promise}
     */
    async commentProvider(options: Partial<NicoLiveConnectPreference> = {})
    {
        _.defaults(options, {connect: false})

        if (this._commentProvider != null) {
            return Promise.resolve(this._commentProvider)
        }

        const provider = CommentProvider.instanceFor(this, options)
        this._commentProvider = provider
        provider.onDidEndLive(this._didEndLive.bind(this))

        if (options.connect) {
            await provider.connect(options)
        }

        return provider
    }


    /**
     * APIから取得した情報をパースします。
     * @private
     * @param {String}   res     API受信結果
     */
    parse(res)
    {
        const $res    = Cheerio.load(res)
        const $root   = $res(":root")
        const $stream = $res("stream")
        const $user   = $res("user")
        const $rtmp   = $res("rtmp")
        const $ms     = $res("ms")
        let props     = null

        if ($root.attr("status") !== "ok") {
            const errorCode = $res("error code").text()
            throw new NicoException({
                message: `Failed to parse live info (${errorCode})`,
                code : errorCode,
                response : res
            })
        }

        props = {
            stream  : {
                liveId      : $stream.find("id").text(),
                title       : $stream.find("title").text(),
                description : $stream.find("description").text(),

                watchCount  : $stream.find("watch_count").text()|0,
                commentCount: $stream.find("comment_count")|0,

                baseTime    : new Date(($stream.find("base_time").text()|0) * 1000),
                openTime    : new Date(($stream.find("open_time").text()|0) * 1000),
                startTime   : new Date(($stream.find("start_time").text()|0) * 1000),
                endTime     : new Date(($stream.find("end_time")|0) * 1000),

                isOfficial  : $stream.find("provider_type").text() === "official",
                isNsen      : $res("ns").length > 0,
                nsenType    : $res("ns nstype").text() || null,

                contents    : _.map($stream.find("contents_list contents"), function(el) {
                    let left, left1
                    const $content = Cheerio(el)
                    return {
                        id              : $content.attr("id"),
                        startTime       : new Date(($content.attr("start_time")|0) * 1000),
                        disableAudio    : ($content.attr("disableAudio")|0) === 1,
                        disableVideo    : ($content.attr("disableVideo")|0) === 1,
                        duration        : (left = $content.attr("duration")|0) != null ? left : null, // ついてない時がある
                        title           : (left1 = $content.attr("title")) != null ? left1 : null,      // ついてない時がある
                        content         : $content.text()
                    }})
            },

            // 放送者情報
            owner   : {
                userId      : $stream.find("owner_id").text()|0,
                name        : $stream.find("owner_name").text()
            },

            // ユーザー情報
            user    : {
                id          : $user.find("user_id").text()|0,
                name        : $user.find("nickname").text(),
                isPremium   : $user.find("is_premium").text() === "1"
            },

            // RTMP情報
            rtmp    : {
                isFms       : $rtmp.attr("is_fms") === "1",
                port        : $rtmp.attr("rtmpt_port")|0,
                url         : $rtmp.find("url").text(),
                ticket      : $rtmp.find("ticket").text()
            },

            // コメントサーバー情報
            comment : {
                addr        : $ms.find("addr").text(),
                port        : $ms.find("port").text()|0,
                thread      : $ms.find("thread").text()|0
            },

            _hasError: $res("getplayerstatus").attr("status") !== "ok"
        }

        return props
    }


    /**
     * 番組情報を最新の状態に同期します。
     * @return {Promise}
     */
    async fetch()
    {
        const res = await APIEndpoints.live.getPlayerStatus(this._session, {liveId : this.id})

        // check errors
        if (res.statusCode === 503) {
            throw new NicoException({
                message: sprintf("Live[%s]: Nicovideo has in maintenance.", this.id)
            })
        }

        this._attr = this.parse(res.body)
        this.emit("did-refresh", this)
    }

    /**
     * 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
     */
    dispose() {
        if (this._commentProvider != null) {
            this._commentProvider.dispose()
        }

        this._commentProvider = null
        super.dispose()
    }


    //
    // Event Listeners
    //

    private _didEndLive() {
        this._attr.isEnded = true
    }


    //
    // Event Handlers
    //
    onDidRefresh(listener: Function)
    {
        return this.on("did-refresh", listener)
    }
}
