let NicoLiveApi;
const _ = require("lodash");
const NicoLiveInfo = require("./NicoLiveInfo");
const NsenChannels = require("./NsenChannels");
const NsenChannel = require("./NsenChannel");


module.exports =
(NicoLiveApi = (function() {
    NicoLiveApi = class NicoLiveApi {
        static initClass() {
            this.prototype._session         = null;
    
            this.prototype._nsenChannelInstances    = null;
            this.prototype._nicoLiveInstances       = null;
        }

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
            if ((typeof liveId !== "string") || (liveId === "")) {
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
        getNsenChannelHandlerFor(channel, options) {
            if (options == null) { options = {}; }
            const isValidChannel = _.select(NsenChannels, {'id': channel}).length === 1;

            if (!isValidChannel) {
                throw new RangeError(`Invalid Nsen channel: ${channel}`);
            }

            if (this._nsenChannelInstances[channel] != null) { return Promise.resolve(this._nsenChannelInstances[channel]); }

            return this.getLiveInfo(channel)
            .then(live => {
                return NsenChannel.instanceFor(live, options, this._session);
            }).then(instance => {
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
            for (var instance of Array.from(this._nsenChannelInstances)) {
                instance.dispose();
            }

            for (instance of Array.from(this._nicoLiveInstances)) {
                instance.dispose();
            }

            return DisposeHelper.wrapAllMembers(this);
        }
    };
    NicoLiveApi.initClass();
    return NicoLiveApi;
})());
