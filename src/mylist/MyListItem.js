/**
 * マイリストの項目モデルです。
 *
 * Properties
 *  getメソッドを通じて第１階層まで取得できます。
 *  Example. mylistItem.get("movie").title
 *
 *  - id             : number    -- マイリスト項目ID
 *  - type           : number    -- 項目の種類（動画、静画など）
 *  - description    : string    -- マイリストコメント
 *  - createTime     : Date      -- 追加日
 *  - updateTime     : Date      -- 更新日（？）
 *  - watch          : number    -- 不明
 *  - movie          : Object    -- 動画情報
 *      - id             : string    -- 動画ID
 *      - title          : string    -- 動画タイトル
 *      - length         : number    -- 動画の長さ（秒）
 *      - thumbnail      : string    -- サムネイル画像のURL
 *
 *      - groupType      : string    -- 不明
 *      - lastResponse   : string    -- 最近投稿されたコメントの一部
 *      - isDeleted      : boolean   -- 削除されているか
 *
 *      - updateTime     : Date      -- この情報の最終更新日時（？）
 *      - firtsRetrieve  : Date      -- 動画投稿日
 *
 *      - count                  -- カウンタ系の情報が詰められたオブジェクト
 *          - view       : number    -- 再生数
 *          - comments   : number    -- コメント数
 *          - mylist     : number    -- マイリスト数
 *
 * @class MyListItem
 */

import _ from "lodash";
import __ from "lodash-deep";
import Ent from "ent";
import Emitter from "../Emitter";

import { sprintf } from "sprintf";
import deepFreeze from "deep-freeze";

export default class MyListItem extends Emitter {
    /**
     * @static
     * @property {Object}    ItemTypes           アイテムの種類のリスト
     * @property {Number}    ItemTypes.movie     動画
     * @property {Number}    ItemTypes.seiga     静画
     */
    static ItemTypes       = deepFreeze({
        MOVIE : 0,
        SEIGA : 5,
        BOOK : 6,
        BLOMAGA : 13
    });

    static defaults        = {
        id              : -1,
        type            : -1,
        description     : null,
        createTime      : null,
        updateTime      : null,
        watch           : 0,

        movie           : null
    };

    /**
     * MylistAPIの取得結果の一部からMyListItemのオブジェクトを生成します。
     * @static
     * @method fronApiResponse
     * @param {Object}   itemInfo
     * @param {MyList}   mylist
     */
    static fromApiResponse(itemInfo, mylist) {
        let item = new MyListItem();
        item._attr = deepFreeze(MyListItem.parse(itemInfo));
        item.list = mylist;

        return Object.defineProperties(item, {
            id : {
                value : item.get("id") | 0
            }
        }
        );
    }


    static parse(itemInfo) {
        let item = itemInfo.item_data;

        let attr = {
            id          : itemInfo.item_id|0,
            type        : itemInfo.item_type|0,
            description : itemInfo.description,
            watch       : itemInfo.watch,

            createTime  : new Date(itemInfo.create_time * 1000),
            updateTime  : new Date(itemInfo.update_time),

            movie       : {
                id          : item.video_id,

                title       : Ent.decode(item.title),
                length      : item.length_seconds|0, // 秒数
                thumbnail   : item.thumbnail_url,

                groupType       : item.group_type,
                lastResponse    : item.last_res_body,
                isDeleted       : item.deleted !== "0",

                updateTime      : new Date(item.update_time * 1000),
                firtsRetrieve   : new Date(item.first_retrieve * 1000),

                count           : {
                    view            : item.view_counter|0,
                    comments        : item.num_res|0,
                    mylist          : item.mylist_counter|0
                }
            }
        };

        return attr;
    }

    /**
     * @private
     * @property {Object}    _attr
     */

    /**
     * @property {Number}    id
     */

    /**
     * @param {String}   path
     * @return
     */
    get(path) {
        return __.deepGet(this._attr, path);
    }

    /**
     * @return {Promise}
     */
    delete() {
        return this.list.deleteItem(this);
    }

    /**
     * @return {Boolean}
     */
    isMovie() {
        return this.get("type") === MyListItem.ItemTypes.MOVIE;
    }

    /**
     * @return {Boolean}
     */
    isSeiga() {
        return this.get("type") === MyListItem.ItemTypes.SEIGA;
    }

    /**
     * @return {Boolean}
     */
    isBook() {
        return this.get("type") === MyListItem.ItemTypes.BOOK;
    }

    /**
     * @return {Boolean}
     */
    isBlomaga() {
        return this.get("type") === MyListItem.ItemTypes.BLOMAGA;
    }
};
