import * as _ from 'lodash'
import Cheerio from 'cheerio'
import {sprintf} from 'sprintf'
import * as deepFreeze from 'deep-freeze'


import * as APIEndpoints from '../APIEndpoints'
import NicoSession from '../NicoSession'
import {NicoLiveConnectPreference} from './CommentProvider'

import NicoException from '../NicoException'
import Emitter from '../Emitter'
import Live from './CommentProvider'

export

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

    private _isEnded: boolean
    private _commentProvider: Live
    private _session: NicoSession

    public id: string
    public metadata: NicoLiveMetadata

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
    public isOfficialLive(): boolean
    {
        return !!this.metadata.stream.isOfficial
    }

    /**
     * 放送が終了しているか
     * @return {boolean}
     */
    public isEnded()
    {
        return this._isEnded === true
    }


    /**
     * この放送に対応するCommentProviderオブジェクトを取得します。
     * @param {Object} options 接続設定
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @param {Boolean} [options.connect] trueを指定するとコネクション確立後にresolveします
     * @return {Promise}
     */
    async getCommentProvider(this: NicoLiveInfo, options: Partial<NicoLiveConnectPreference> = {}): Promise<Live>
    {
        _.defaults(options, {connect: false})

        if (this._commentProvider != null) {
            return this._commentProvider
        }

        const provider = Live.instanceFor(this, options)
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
    private _parse(this: NicoLiveInfo, res: string)
    {

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

        this._attr = this._parse(res.body)
        this.emit("did-refresh", this)
    }

    /**
     * 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
     */
    public dispose() {
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
        this._isEnded = true
    }


    //
    // Event Handlers
    //
    public onDidRefresh(listener: Function)
    {
        return this.on("did-refresh", listener)
    }
}
