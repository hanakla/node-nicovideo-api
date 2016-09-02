import _ from "lodash";
import Request from "request-promise";
import Deferred from "promise-native-deferred";

import NicoUrl from "../NicoURL";
import MyListMeta from "./MyListMeta";
import MyList from "./MyList";

// 30秒以上経過したらトークンを取得する
let FETCH_INTERVAL = 30 * 1000;

// トークン抽出用パターン
let tokenRegexp = /NicoAPI.token = "([0-9a-z\-]*)";/;


/**
 * ニコニコ動画のマイリスト操作APIのラッピングを行います。
 * （参考: http://efcl.info/wiki/niconicoapi/）
 *
 * @TODO Manage MyList instances for support dispose.
 * @class NicoMyListApi
 */
export default class NicoMyListApi {
    /**
     * @private
     * @property {NicoSession} _session
     */

    /**
     * 認証トークン
     * @private
     * @property {Object} _token
     * @property {Number} _token.timestamp   トークンを取得した時間（ミリ秒）
     * @property {String} _token.token       マイリスト操作用トークン
     */


    /**
     * @constructor
     * @class NicoMyListApi
     * @param {NicoSession}      session
     */
    constructor(_session) {
        this._session = _session;
        this._token = {
            timestamp   : null,
            token       : null
        };
    }


    /**
     * マイリストを操作するための認証トークンを取得します。
     * @method fetchToken
     * @return {Promise}
     */
    fetchToken() {
        // 一定時間以内に取得したトークンがあればそれを返す
        if ((this._token.token != null) && (Date.now() - this._token.timestamp) < FETCH_INTERVAL) {
            return Promise.resolve(this._token.token);
        }

        // トークン取得
        return Request.get({
            resolveWithFullResponse : true,
            url : NicoUrl.MyList.FETCH_TOKEN,
            jar : this._session.cookie
        })
        .then(res => {
            // データを取得したらトークンを取り出す
            let token = tokenRegexp.exec(res.body);

            if (token[1] != null) {
                this._token.timestamp = Date.now();
                this._token.token = token[1];

                return Promise.resolve(token[1]);
            } else {
                return Promise.reject("NicoMyListApi: Failed to pick token.");
            }
        }
        );
    }


    /**
     * マイリストの一覧を取得します。
     * @method fetchMyListsIndex
     * @param    {boolean} withoutHome
     *   trueを指定すると"とりあえずマイリスト"を一覧から除外します。
     * @return   {Promise}
     * - resolve : (mylists: Array.<MyListItemIndex>)
     * - reject : (message: String)
     */
    fetchOwnedListIndex(withoutHome = false) {
        // 受信したデータからインデックスを作成
        return Request.get({
            resolveWithFullResponse : true,
            url   : NicoUrl.MyList.GET_GROUPS,
            jar   : this._session.cookie
        })
        .then(function(res) {
            try {
                let result  = JSON.parse(res.body);
                let lists   = [];

                if (result.status !== "ok") {
                    return Promise.reject("Failed to fetch mylist. (reason unknown)");
                }

                // とりあえずマイリスト
                if (withoutHome === false) {
                    lists.push(MyListMeta.instance("home"));
                }

                _.each(result.mylistgroup, group => {
                    lists.push(MyListMeta.instance(group));
                }
                );

                return Promise.resolve(lists);
            } catch (e) {
                return Promise.reject(`Failed to fetch mylist. (${e.message})`);
            }
        });
    }


    /**
     * MyListインスタンスを取得します。
     * @method fetchMyList
     * @param    {MyListItemIndex|number} id
     *   MyListItemIndexかマイリストIDを渡します。
     * @return   {Promise(MyList, string)}
     *   取得できればMyListオブジェクトと共にresolveされ、
     *   そうでなければエラーメッセージと共にrejectされます
     */
    getHandlerFor(id = "home") {
        return new Promise((resolve, reject) => {
            if (id instanceof MyListMeta) {
                resolve(MyList.instanceById(id, this._session));
                return;
            }

            if (id !== "home") { id = (id | 0); }

            this.fetchOwnedListIndex(false).then(metaList => {
                let meta = _.where(metaList, {id});

                if (meta.length === 0) {
                    return reject(`Can't find specified mylist.(${id})`);
                } else {
                    return resolve(MyList.instanceById(meta[0], this._session));
                }
            }
            );

        }
        )

        .then(mylist => {
            let defer = new Deferred();
            mylist.fetch().then((() => defer.resolve(mylist)), defer.reject);
            return defer.promise;
        }
        );
    }
};
