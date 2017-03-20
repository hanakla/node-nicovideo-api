let NicoVideoApi;
const QueryString = require("querystring");

const NicoVideoInfo   = require("./NicoVideoInfo");
const APIEndpoints = require("../APIEndpoints");

/**
 * ニコニコ動画APIへのアクセスを担当するクラス
 * @class NicoVideoApi
 */
module.exports =
(NicoVideoApi = (function() {
    NicoVideoApi = class NicoVideoApi {
        static initClass() {
            this.NicoVideoInfo  = NicoVideoInfo;
    
            /**
             * @private
             * @property _session
             * @type NicoSession
             */
            this.prototype._session         = null;
        }

        /**
         * @class NicoVideoApi
         * @param {NicoSession}      session
         */
        constructor(_session) {
            this._session = _session;
        }

        /**
         * 動画情報(NicoVideoInfo）を取得します。
         *
         * 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
         *
         * @param    {string}    movieId 情報を取得したい動画ID
         * @return   {Promise}
         * - resolve : (info: NicoVideoInfo)
         */
        getVideoInfo(movieId) {
            return NicoVideoInfo.fetch(movieId, this._session);
        }

        /**
         * getflv APIの結果を取得します。
         */
        getFlv(movieId) {
            return APIEndpoints.video.getFlv(this._session, {movieId}).then(res => Promise.resolve(QueryString.parse(res.body)));
        }
    };
    NicoVideoApi.initClass();
    return NicoVideoApi;
})());
