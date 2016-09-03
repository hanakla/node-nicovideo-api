import _ from "lodash";
import NicoLiveInfo from "./NicoLiveInfo";
import NsenChannels from "./NsenChannels";
import NsenChannel from "./NsenChannel";


export default class NicoLiveApi {
    _session         = null;

    _nsenChannelInstances    = null;
    _nicoLiveInstances       = null;

    /**
     * @param {NicoSession} _session
     */
    constructor(_session) {
        this._session = _session;
        this._nsenChannelInstances  = {};
        this._nicoLiveInstances     = {};
    }

    /**
     * 指定された放送の情報を取得します。
     *
     * 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
     * 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
     *
     * @param {string}   liveId  放送ID
     * @return {Promise}
     */
    getLiveInfo(liveId) {
        if (typeof liveId !== "string" || liveId === "") {
            throw new TypeError("liveId must bea string");
        }

        if (this._nicoLiveInstances[liveId] != null) { return Promise.resolve(this._nicoLiveInstances[liveId]); }

        return NicoLiveInfo.instanceFor(liveId, this._session)
        .then(liveInfo => {
            this._nicoLiveInstances[liveId] = liveInfo;
            return Promise.resolve(liveInfo);
        }
        );
    }


    /**
     * NsenChannelのインスタンスを取得します。
     *
     * @param {String} channel
     * @param {Object} [options]
     * @param {Boolean} [options.connect=false] NsenChannel生成時にコメントサーバーへ自動接続するか指定します。
     * @param {Number} [options.firstGetComments] 接続時に取得するコメント数
     * @param {Number} [options.timeoutMs] タイムアウトまでのミリ秒
     * @return {Promise}
     */
    getNsenChannelHandlerFor(channel, options = {}) {
        let isValidChannel = _.select(NsenChannels, {'id': channel}).length === 1;

        if (!isValidChannel) {
            throw new RangeError(`Invalid Nsen channel: ${channel}`);
        }

        if (this._nsenChannelInstances[channel] != null) { return Promise.resolve(this._nsenChannelInstances[channel]); }

        return this.getLiveInfo(channel)
        .then(live => {
            return NsenChannel.instanceFor(live, options, this._session);
        }
        )

        .then(instance => {
            this._nsenChannelInstances[channel] = instance;
            instance.onWillDispose(() => {
                return delete this._nsenChannelInstances[channel];
            });

            return Promise.resolve(instance);
        }
        );
    }


    /**
     * 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
     */
    dispose() {
        for (let i = 0; i < this._nsenChannelInstances.length; i++) {
            var instance = this._nsenChannelInstances[i];
            instance.dispose();
        }

        for (let j = 0; j < this._nicoLiveInstances.length; j++) {
            var instance = this._nicoLiveInstances[j];
            instance.dispose();
        }

        return DisposeHelper.wrapAllMembers(this);
    }
};
