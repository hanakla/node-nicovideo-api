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
import _ from 'lodash';
import { Emitter } from 'event-kit';
import Request from 'request-promise';

import APIEndpoints from '../APIEndpoints';
import MyListItem from './MyListItem';
import MyListItemType from '../const/MyListItemType';

import {
    NicoException,
    JSONParseError,
} from '../errors/';

class NormalListAPIEndpoints {
    static fetchItems(session, mylistId) {
        return APIEndpoints.MyList.fetchItems(session, mylistId);
    }

    static addItem(session, payload) {
        return APIEndpoints.MyList.addItem(session, payload);
    }
}

class DefaultListAPIEndpoints {
    static fetchItems(session) {
        return APIEndpoints.MyList.fetchDefaultListItems(session);
    }
}

export default class MyList extends Emitter {
    static _cache  = {};

    static _attr  = {
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
    };


    /**
     * @param {MyListMeta}   myListMeta
     * @param {NicoSession}  session
     * @return Promise
     */
    static instanceById(myListMeta, session) {
        let { id } = myListMeta;
        let list = new MyList(myListMeta, session);

        if (MyList._cache[id] != null) { return Promise.resolve(MyList._cache[id]); }
        return list.fetch().then(() => Promise.resolve(list));
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
    _session  = null;

    /**
     * @private
     * @property {Object} _attr マイリスト情報
     */
    _attr  = null;

    /**
     * @property {Array.<MyListItem>} items 登録されている動画のリスト
     */
    items  = null;

    /*
     * @param {MyListMeta}   metaInfo    操作対象の MyListMetaのインスタンス。
     * @param {NicoSession}  session     セッション
     */
    constructor(metaInfo, _session) {
        super();

        this._session = _session;
        this._attr = metaInfo.toJSON();
        this.items = [];

        Object.defineProperties(this, {
            id : {
                get() { return metaInfo.get("id"); },
            },
            api : {
                value : metaInfo.get("id") === "home" ? DefaultListAPIEndpoints : NormalListAPIEndpoints,
            }
        });
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
    async fetch() {
        let response, json;

        try {
            response = await this.api.fetchItems(this._session, this.id)
        } catch (e) {
            throw new NicoException({
                message     : `Failed to fetch items (Connection error: ${e.message})`,
                previous    : e
            });
        }

        try {
            json = JSON.parse(response.body);
        } catch (e) {
            throw new JSONParseError({
                response    : response,
                previous    : e
            });
        }

        if (json.status !== "ok") {
            throw new NicoException({
                message     : "Failed to fetch contents (invalid status)",
                response    : response
            });
        }

        this.items = [];
        _.each(json.mylistitem.reverse(), item => {
            let m = MyListItem.fromApiResponse(item, this);
            return this.items.push(m);
        });

        this.emit("did-refresh", {list: this});
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
        if (!Array.isArray(items)) { items = [items]; }

        let validItems = _.select(items, item => item instanceof MyListItem);
        let havingItems = _.select(validItems, "list", this);
        return _.pluck(havingItems, 'id');
    }

    /**
     * マイリストに動画を追加します。
     * @param {NicoVideoInfo|string} movie   追加する動画のNicoVideoInfoオブジェクトか動画ID
     * @param {string?}              desc    マイリストの動画メモの内容
     * @return {Promise}
     */
    async addMovie(movie, desc = "") {
        let movieId, responseJson;

        // movieが文字列じゃない上に、オブジェクトじゃないとか、idプロパティがない場合
        if (!typeof movie !== "string" && (movie.id == null)) {
            throw new TypeError("Invalid type for argument 1(movie)");
        } else {
            movieId = _.isString(movie) ? movie : movie.id;
        }

        const response = this.api.addItem({
            item_type   : MyListItemType.MOVIE,
            item_id     : movieId,
            token       : await this._session.mylist.fetchToken(),
            description : desc,
            group_id    : this.id
        });


        try {
            responseJson = JSON.parse(response.body);
        } catch (e) {
            throw new JSONParseError({
                message: `MyList[${this.id}]: Failed to add item (JSON parse error)`,
                response: response,
                tryToParse: response.body,
                previous: e,
            });
        }

        if (responseJson.status !== "ok") {
            throw new NicoException({
                message     : `MyList[${this.id}]: Failed to add item (reason: ${responseJson.error.description})`,
                response    : response,
            });
        }
    }


    /**
     * マイリストから項目を削除します。
     *
     * 渡されたアイテム内のこのリストの項目でないものは無視されます。
     *
     * @param {MyListItem|Array.<MyListItem>}    items   削除する項目の配列
     * @return {Promise} 成功した時に削除された項目数でresolveします。
     */
    async deleteItem(items) {
        const itemIds = this._pickHavingItemIds(items);

        if (itemIds.length === 0) {
            return;
        }

        const response = await this.api.deleteItem({
            group_id : this.id,
            "id_list[0]" : itemIds,
            token: await this._session.mylist.fetchToken(),
        });

        let responseJson;
        try {
            responseJson = JSON.parse(response.body);
        } catch (e) {
            throw new JSONParseError({
                message: `MyList[${this.id}]: Failed to delete item`,
                response: response,
                tryToParse: response.body,
                previous: e,
            });
        }

        if (responseJson.status !== "ok") {
            throw new NicoException({
                message     : `MyList[${this.id}]: Failed to delete item (reason: ${responseJson.error.description})`,
                response    : response,
            });
        }
    }

    /**
     * マイリストから別のマイリストへ項目を移動します。
     *
     * 渡された項目内のこのリストの項目でないものは無視されます。
     *
     * @param {MyListItem|Array.<MyListItem>}    items   移動する項目の配列
     * @param {MyList}   targetMyList    移動先のマイリスト
     * @return {Promise}
     */
    async moveItem(items, targetMyList) {
        if (!(targetMyList instanceof MyList)) {
            throw new TypeError("targetMyList must be instance of MyList");
        }

        let itemIds = this._pickHavingItemIds(items);
        if (itemIds.length === 0) {
            return;
        }

        const response = await Request.post({
            resolveWithFullResponse : true,
            url : this._urlSet.MOVE,
            jar : this._session.cookie,
            form : {
                group_id : this.id,
                target_group_id : targetMyList.id,
                "id_list[0]" : itemIds,
                token: await this._session.mylist.fetchToken(),
            },
        });

        let responseJson;
        try {
            responseJson = JSON.parse(response.body);
        } catch (e) {
            return Promise.reject("Mylist[%s]: Failed to move item (JSON parse error)");
        }

        if (responseJson.status !== "ok") {
            throw new NicoException({
                message     : `MyList[${this.id}]: Failed to delete item (reason: ${responseJson.error.description})`,
                response    : response,
            });
        }
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
