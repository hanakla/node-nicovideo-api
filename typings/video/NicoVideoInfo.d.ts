import NicoSession from '../NicoSession';
export interface NicoMovieMetadata {
    /** 動画ID */
    id: string;
    /** 動画タイトル */
    title: string;
    /** 動画説明文 */
    description: string;
    /** 動画の長さ（秒） */
    length: number;
    /** 動画ファイルの形式(mp4, flv, swf) */
    movieType: string;
    /** サムネイル画像のURL */
    thumbnail: string;
    /** 削除されているか（現在、常にfalse） */
    isDeleted: boolean;
    /** 統計情報 */
    stats: {
        /** 再生数 */
        view: number;
        /** コメント数 */
        comments: number;
        /** マイリスト数 */
        mylist: number;
    };
    /** タグ情報 */
    tags: {
        /** タグ名 */
        name: string;
        /** カテゴリタグか */
        isCategory: boolean;
        /** ロックされているか */
        isLocked: boolean;
        /** どの国のタグか（日本="jp"） */
        domain: string;
    }[];
    /** 投稿者情報 */
    user: {
        /** ユーザーID */
        id: number;
        /** ユーザー名 */
        name: string;
        /** ユーザーアイコンのURL */
        icon: string;
    };
}
/**
 * ニコニコ動画APIの動画情報モデルクラス
 *
 * Properties
 *   getメソッドで第１階層まで取得できます。
 *   Example: NicoVideoInfo.get("user").id
 *
 *
 * @class NicoVideoInfo
 * @extends EventEmitter2
 */
export default class NicoVideoInfo {
    private _session;
    private static defaults;
    static fetch(movieId: string, session: NicoSession): Promise<NicoVideoInfo>;
    /**
     * @private
     * @param {String}   resBody     getThumbInfoAPIから取得したXML
     * @return {Object}
     */
    private static _parseResponse(resBody, movieId);
    /**
     * @class NicoVideoInfo
     * @constructor
     * @param {String}       movieId     動画ID
     * @param {NicoSession} _session     セッション
     */
    constructor(movieId: string, _session: NicoSession);
    metadata: NicoMovieMetadata;
    /**
     * 動画が削除されているか調べます。
     * @return {Boolean}
     */
    isDeleted(): any;
    /**
     * この動画のgetflv APIの結果を取得します。
     * @return {Promise}
     */
    fetchGetFlv(): any;
    /**
     * 属性を取得します。
     * @param {String}       path        属性名(Ex. "id", "title", "user.id")
     */
    get(path: any): any;
}
