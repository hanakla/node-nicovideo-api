import NicoSession from '../NicoSession';
import NicoLiveInfo from './NicoLiveInfo';
export default class NicoLiveApi {
    private _session;
    private _nicoLiveInstances;
    /**
     * @param {NicoSession} _session
     */
    constructor(_session: NicoSession);
    /**
     * 指定された放送の情報を取得します。
     *
     * 番組情報が取得できればNicoLiveInfoオブジェクトとともにresolveされます。
     * 取得中にエラーが発生した場合、エラーメッセージとともにrejectされます。
     *
     * @param {string}   liveId  放送ID
     * @return {Promise}
     */
    getLiveInfo(liveId: string): Promise<NicoLiveInfo>;
    /**
     * 現在のインスタンスおよび、関連するオブジェクトを破棄し、利用不能にします。
     */
    dispose(): void;
}
