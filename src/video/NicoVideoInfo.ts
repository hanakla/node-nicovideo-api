import * as cheerio from "cheerio"
import * as deepFreeze from "deep-freeze"
import * as Ent from "ent"

import APIEndpoints from "../APIEndpoints"
import NicoSession from '../NicoSession'
import NicoException from "../NicoException"

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
    private static defaults = {
        title           : null,
        description     : null,
        length          : null,      // 秒数
        movieType       : null,      // "flv", "mp4"
        thumbnail       : null,
        isDeleted       : false,
        count           : {
            view            : -1,
            comments        : -1,
            mylist          : -1
        },

        tags            : [],        // {name:string, isCategory:boolean, isLocked:boolean}
        user            : {
            id              :  -1,
            name            : null,
            icon            : null
        }  // URL
    }

    public static async fetch(movieId: string, session: NicoSession) {

    }

    /**
     * @private
     * @param {String}   resBody     getThumbInfoAPIから取得したXML
     * @return {Object}
     */


    /**
     * @class NicoVideoInfo
     * @constructor
     * @param {String}       movieId     動画ID
     * @param {NicoSession} _session     セッション
     */
    constructor(movieId: string, private _session: NicoSession) {
        // 指定された動画の動画情報インスタンスがキャッシュされていればそれを返す
        // キャッシュに対応する動画情報インスタンスがなければ、新規作成してキャッシュ
        // return VideoInfo._cache[movieId] if VideoInfo._cache[movieId]?

        // @_attr = _.cloneDeep(NicoVideoInfo.defaults)

        this._session = _session;
        Object.defineProperties(this, {
            id : {
                value : movieId
            }
        }
        );
    }

    public metadata: NicoMovieMetadata

    /**
     * 動画が削除されているか調べます。
     * @return {Boolean}
     */
    isDeleted() {
        return this.get("isDeleted");
    }

    /**
     * この動画のgetflv APIの結果を取得します。
     * @return {Promise}
     */
    fetchGetFlv() {
        return this._session.video.getFlv(this.id);
    }


    /**
     * 属性を取得します。
     * @param {String}       path        属性名(Ex. "id", "title", "user.id")
     */
    get(path) {
        return __.deepGet(this._attr, path);
    }
}
