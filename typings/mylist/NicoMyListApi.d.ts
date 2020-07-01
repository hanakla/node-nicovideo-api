import NicoSession from '../NicoSession';
export interface MylistSummary {
    /** マイリストID */
    id: number | 'home';
    /** マイリストの説明 */
    description: string;
    /** ユーザー番号 */
    userId: number;
    /** 標準のソート方法（？） */
    defaultSort: number;
    /** ソート方式（？） */
    sortOrder: number;
    /** マイリストのアイコンID */
    iconId: number;
    /** リスト名 */
    name: string;
    /** 公開マイリストかどうか */
    public: boolean;
    /** マイリストの作成日 */
    createTime: Date;
    /** マイリストの更新日 */
    updateTime: Date;
}
export interface HomeListSummary {
    id: 'home';
    name: string;
    public: boolean;
}
/**
 * ニコニコ動画のマイリスト操作APIのラッピングを行います。
 * （参考: http://efcl.info/wiki/niconicoapi/）
 *
 * @TODO Manage MyList instances for support dispose.
 * @class NicoMyListApi
 */
export default class NicoMyListApi {
    private _session;
    /**
     * @private
     * @property {NicoSession} _session
     */
    /** 認証トークン */
    private _token;
    /**
     * @constructor
     * @class NicoMyListApi
     * @param {NicoSession}      session
     */
    constructor(_session: NicoSession);
    /**
     * マイリストを操作するための認証トークンを取得します。
     * @method fetchToken
     * @return {Promise}
     */
    fetchToken(): Promise<string>;
    /**
     * マイリストの一覧を取得します。
     * @method fetchMyListsIndex
     * @param    {boolean} withoutHome
     *   trueを指定すると"とりあえずマイリスト"を一覧から除外します。
     * @return   {Promise}
     * - resolve : (mylists: Array.<MyListItemIndex>)
     * - reject : (message: String)
     */
    fetchOwnedListIndex(withoutHome?: boolean): Promise<Array<MylistSummary | HomeListSummary>>;
    /**
     * MyListインスタンスを取得します。
     * @method fetchMyList
     * @param    {MyListItemIndex|number} id
     *   MyListItemIndexかマイリストIDを渡します。
     * @return   {Promise(MyList, string)}
     *   取得できればMyListオブジェクトと共にresolveされ、
     *   そうでなければエラーメッセージと共にrejectされます
     */
    getHandlerFor(id?: 'home' | number): Promise<any>;
}
