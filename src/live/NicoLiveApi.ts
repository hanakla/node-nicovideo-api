import * as _ from 'lodash'
import NicoSession from '../Session'
import NicoLiveInfo from './NicoLiveInfo'
import NsenChannels from './NsenChannels'
import NsenChannel from './NsenChannel'
import {NicoLiveConnectPreference} from './CommentProvider'

type NsenChannelIds =
    'nsen/vocaloid'
    | 'nsen/toho'
    | 'nsen/nicoindies'
    | 'nsen/sing'
    | 'nsen/play'
    | 'nsen/pv'
    | 'nsen/hotaru'
    | 'nsen/allgenre'


export default class NicoLiveApi {
    private _nsenChannelInstances: {[chId: string]: NsenChannel} = {}
    private _nicoLiveInstances: {[liveId: string]: NicoLiveInfo} = {}

    /**
     * @param {NicoSession} _session
     */
    constructor(private _session: NicoSession) {}

    /**
     * 指定された放送の情報を取得します。
     *
     * 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
     * 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
     *
     * @param {string}   liveId  放送ID
     * @return {Promise}
     */
    async getLiveInfo(liveId: string): Promise<NicoLiveInfo>
    {
        if (typeof liveId !== "string" || liveId === "") {
            throw new TypeError("liveId must bea string");
        }

        if (this._nicoLiveInstances[liveId]) {
            return this._nicoLiveInstances[liveId]
        }

        const liveInfo = await NicoLiveInfo.instanceFor(liveId, this._session)
        this._nicoLiveInstances[liveId] = liveInfo
        return liveInfo
    }


    /**
     * NsenChannelのインスタンスを取得します。
     *
     * @param {String} channel
     * @param {Object} [options]
     * @param {Boolean} [options.connect] NsenChannel生成時にコメントサーバーへ自動接続するか指定します。
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @return {Promise}
     */
    async getNsenChannelHandlerFor(channel: NsenChannelIds, options: Partial<NicoLiveConnectPreference> = {}): NsenChannel
    {
        const isValidChannel = _.select(NsenChannels, {'id': channel}).length > 0;
        if (!isValidChannel) {
            throw new RangeError(`Invalid Nsen channel: ${channel}`);
        }

        if (this._nsenChannelInstances[channel] != null) {
            return this._nsenChannelInstances[channel]
        }

        const live = await this.getLiveInfo(channel)
        const nsenChannel =  NsenChannel.instanceFor(live, options, this._session);

        this._nsenChannelInstances[channel] = nsenChannel;
        nsenChannel.onWillDispose(() => {
            delete this._nsenChannelInstances[channel];
        })

        return nsenChannel
    }


    /**
     * 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
     */
    dispose() {
        for (const instance of Object.values(this._nsenChannelInstances)) {
            instance.dispose();
        }

        for (instance of Object.values(this._nicoLiveInstances)) {
            instance.dispose();
        }

        // DisposeHelper.wrapAllMembers(this);
    }
};