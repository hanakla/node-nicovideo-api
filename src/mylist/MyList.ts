/**
 * Properties
 *  attrメソッドを介して取得します。（とりあえずマイリストの場合、属性は一切設定されません。）
 *      Example: mylist.attr("id") // -> マイリストIDを取得
 *  - id             : number    -- マイリストID
 *  - name           : string    -- リスト名
 *  - description    : string    -- マイリストの説明
 *  - public         : boolean   -- 公開マイリストかどうか
 *  - iconId         : number    -- マイリストのアイコンID
 *  - defaultSort    : number    -- 標準のソート方法（？）
 *  - sortOrder      : number    -- ソート方式（？）
 *  - userId         : number    -- ユーザー番号
 *  - createTime     : Date      -- マイリストの作成日
 *  - updateTime     : Date      -- マイリストの更新日
 */
import * as _  from "lodash"
import {Emitter} from "event-kit"
import * as Request from "request-promise"
import {sprintf} from "sprintf"

import * as NicoUrl from "../NicoURL"
import NicoSession from '../NicoSession'
import NicoException from "../NicoException"
import MyListMeta from "./MyListMeta"
import MyListItem from "./MyListItem"

export default class MyList extends Emitter {
    private static _attr = {
        id          : -1,
        name        : null,
        description : null,
        public      : null,

        iconId      : -1,
        defaultSort : -1,
        sortOrder   : -1,
        userId      : -1,

        createTime  : null,
        updateTime  : null
    }


    /**
     * マイリストが最新の内容に更新された時に発火します
     * @event MyList#did-refresh
     * @property {MyList}    list
     */

    /**
     * マイリストから項目が削除された時に発火します
     * @event MyList#did-delete-item
     * @property {MyList}        list
     * @property {MyListItem}    item
     */

    /**
     * @private
     * @property {NicoSession} _session セッション
     */
    private _session;

    /**
     * @private
     * @property {Object} _urlSet MyList APIのurl
     */
    private _urlSet;

    /**
     * @private
     * @property {Object} _attr マイリスト情報
     */
    private _attr;

    /**
     * @property {Array.<MyListItem>} items 登録されている動画のリスト
     */
    public items;


    /**
     * @param {MyListMeta}   myListMeta
     * @param {NicoSession}  session
     * @return Promise
     */
    static instanceById(myListMeta: MyListMeta, session: NicoSession) {
        const { id } = myListMeta;
        const list = new MyList(myListMeta, session);

        if (MyList._cache[id] != null) { return Promise.resolve(MyList._cache[id]); }
        return list.fetch().then(() => Promise.resolve(list));
    }

    /**
     * @param {MyListMeta}   metaInfo    操作対象の MyListMetaのインスタンス。
     * @param {NicoSession}  session     セッション
     */
    constructor(metaInfo: MyListMeta, _session: NicoSession) {
    {
        super()

        this._session = _session;
        this._attr = metaInfo.toJSON();
        this.items = [];

        Object.defineProperties(this, {
            id : {
                get() { return metaInfo.get("id"); }
            },
            _urlSet : {
                value : metaInfo.get("id") === "home" ? NicoUrl.MyList.DefList : NicoUrl.MyList.Normal
            }
        })
    }

    /**
     * このマイリストが"とりあえずマイリスト"か調べます。
     * @return {boolean} とりあえずマイリストならtrueを返します。
     */
    isDefaultList() {
        return this.id === "home";
    }

    /**
     * マイリストに登録されている動画を取得します。
     *
     * @fires MyList#refreshed
     * @return {Promise}
     */
    fetch(options) {
        return Request.get({
            resolveWithFullResponse : true,
            url     : sprintf(this._urlSet.LIST, this.id),
            jar     : this._session.cookie}).catch(e =>
            Promise.reject(new NicoException({
                message     : `Failed to fetch items (Connection error: ${e.message})`,
                previous    : e
            })
            )).then(res => {
            let json;
            try {
                json = JSON.parse(res.body);
            } catch (e) {
                return Promise.reject(new NicoException({
                    message     : "Failed to parse response",
                    response    : res.body,
                    previous    : e
                })
                );
            }

            return json.status !== "ok" ?
                Promise.reject(new NicoException({
                    message     : "Failed to fetch contents (unknown)",
                    response    : res.body
                })
                ) : undefined;

            this.items = [];
            _.each(json.mylistitem.reverse(), item => {
                const m = MyListItem.fromApiResponse(item, this);
                return this.items.push(m);
            }
            );

            this.emit("did-refresh", {list: this});

        }
        );
    }

    /**
     * マイリストのメタ情報を取得します。
     * @param {string}   attr    取得する属性名
     */
    attr(attr) {
        return this._attr[attr];
    }

    /**
     * @private
     * @param {MyListItem|Array.<MyListItem>}    items
     */
    _pickHavingItemIds(items) {
        let havingItemIds;
        if (!Array.isArray(items)) { items = [items]; }
        const validItems = _.select(items, item => item instanceof MyListItem);
        const havingItems = _.select(items, "list", this);
        return havingItemIds = _.pluck(havingItems, 'id');
    }

    /**
     * マイリストに動画を追加します。
     * @param {NicoVideoInfo|string} movie   追加する動画のNicoVideoInfoオブジェクトか動画ID
     * @param {string?}              desc    マイリストの動画メモの内容
     * @return {Promise}
     */
    addMovie(movie, desc) {
        if (desc == null) { desc = ""; }
        let id      = null;

        // movieが文字列じゃない上に、オブジェクトじゃないとか、idプロパティがない場合
        if ((!typeof movie !== "string") && (movie.id == null)) {
            return Promise.reject(new TypeError("Invalid type for argument 1(movie)"));
        } else {
            id = _.isString(movie) ? movie : movie.id;
        }

        const req = {
            item_type   : 0,
            item_id     : id,
            token       : null,
            description : desc,
            group_id    : this.id
        };

        this.isDefaultList() && (delete req.group_id);

        //-- APIと通信
        // アクセストークンを取得
        return this._session.mylist.fetchToken()
        .then(token => {
            req.token = token;

            return Request.post({
                resolveWithFullResponse : true,
                url : this._urlSet.ADD,
                jar : this._session.cookie,
                form : req
            });
        }).then(res => {
            let result;
            try {
                result = JSON.parse(res.body);
            } catch (e) {
                return Promise.reject("Mylist[%s]: Failed to add item (JSON parse error)");
            }

            return result.status !== "ok" ?
                Promise.reject(new NicoException({
                    message     : result.error.description,
                    response    : result
                })
                ) : undefined;

            return Promise.resolve({response: result});
        });
    }


    /**
     * マイリストから項目を削除します。
     *
     * 渡されたアイテム内のこのリストの項目でないものは無視されます。
     *
     * @param {MyListItem|Array.<MyListItem>}    items   削除する項目の配列
     * @return {Promise} 成功した時に削除された項目数でresolveします。
     */
    deleteItem(items) {
        const itemIds = this._pickHavingItemIds(items);
        if (itemIds.length === 0) { return Promise.resolve({response: null}); }

        return this._session.mylist.fetchToken()
        .then(token => {
            const req = {
                group_id : this.id,
                "id_list[0]" : itemIds,
                token
            };

            if (this.isDefaultList()) { delete req.group_id; }

            return Request.post({
                resolveWithFullResponse : true,
                url : this._urlSet.DELETE,
                jar : this._session.cookie,
                form : req
            });
        }).then(function(res) {
            let e, result;
            try {
                result = JSON.parse(res.body);
            } catch (error) {
                e = error;
                return Promise.reject(new Error("Mylist[%s]: Failed to delete item (JSON parse error)"));
            }

            if (result.status === "ok") {
                return Promise.resolve({response: json});
            } else {
                e = new Error(sprintf("MyList[%s]: Failed to delete item (reason: %s)", this.id, result.error.description));
                e.response = json;
                return Promise.reject(e);
            }
        });
    }

    /**
     * マイリストから別のマイリストへ項目を移動します。
     *
     * 渡された項目内のこのリストの項目でないものは無視されます。
     *
     * @param {MyListItem|Array.<MyListItem>}    items   移動する項目の配列
     * @param　{MyList}   targetMyList    移動先のマイリスト
     * @return {Promise}
     */
    public async  moveItem(items, targetMyList) {
        if (!(targetMyList instanceof MyList)) {
            throw new TypeError("targetMyList must be instance of MyList");
        }

        const itemIds = this._pickHavingItemIds(items);
        if (itemIds.length === 0) { return Promise.resolve({response: null}); }

        return this._session.mylist.fetchToken()
        .then(token => {
            const req = {
                group_id : this.id,
                target_group_id : targetMyList.id,
                "id_list[0]" : itemIds,
                token
            };

            if (this.isDefaultList()) { delete req.group_id; }

            return Request.post({
                resolveWithFullResponse : true,
                url : this._urlSet.MOVE,
                jar : this._session.cookie,
                form : req
            });
        }).then(function(res) {
            let e, result;
            try {
                result = JSON.parse(res.body);
            } catch (error) {
                e = error;
                return Promise.reject("Mylist[%s]: Failed to delete item (JSON parse error)");
            }

            if (result.status === "ok") {
                return Promise.resolve({response: json});
            } else {
                e = new Error(sprintf("MyList[%s]: Failed to delete item (reason: %s)", this.id, result.error.description));
                e.response = result;
                return Promise.reject(e);
            }
        });
    }
    //
    // Event Handlers
    //
    onDidRefresh(listener) {
        return this.on("did-refresh", listener);
    }

    onDidDeleteItem(listener) {
        return this.on("did-delete-item", listener);
    }
}
