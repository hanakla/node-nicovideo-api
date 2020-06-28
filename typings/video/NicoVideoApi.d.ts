import * as NicoVideoInfo from "./NicoVideoInfo";
export { NicoVideoInfo };
/**
 * ニコニコ動画APIへのアクセスを担当するクラス
 * @class NicoVideoApi
 */
export default class NicoVideoApi {
    private _session;
    /**
     * @class NicoVideoApi
     * @param {NicoSession}      session
     */
    constructor(_session: any);
    /**
     * 動画情報(NicoVideoInfo）を取得します。
     *
     * 動画情報が用意できれば取得したNicoVideoInfoオブジェクトと一緒にresolveされます。
     *
     * @param    {string}    movieId 情報を取得したい動画ID
     * @return   {Promise}
     * - resolve : (info: NicoVideoInfo)
     */
    getVideoInfo(movieId: any): any;
    /**
     * getflv APIの結果を取得します。
     */
    getFlv(movieId: any): any;
}
