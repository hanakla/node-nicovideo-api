/**
 *
 *
 *
 * Methods
 *   - attr(attr: string)
 *       指定したプロパティの値を取得します。
 *   - isDefaultList(): boolean
 *       このリストが"とりあえずマイリスト"か判定します。
 *   - getInterface(): MyList
 *       現在のインスタンスのマイリストと対応するMyListインスタンスを取得します。
 *   - toJSON(): Object
 *       インスタンスのプロパティを複製します。
 *
 * Events
 *   (none)
 *
 * Properties
 *   attrメソッドを介して取得します。（とりあえずマイリストの場合,idとname以外設定されません。）
 *       Example. mylist.attr("id") // -> マイリストIDを取得
 */
import * as _ from "lodash"
import MyList from "./MyList"




/**
 * マイリストのメタデータを表すクラスです。
 * このモデルからマイリストを操作することはできません。
 * @class MyListMeta
 */
export default class MyListMeta {
    private static defaults  = {
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
     * @param {Object}   metaInfo    Result of mylistgroup/list API
     */
    public static instance(metaInfo: object|'home') {
        const meta = new MyListMeta;
        meta.data = MyListMeta._parse(metaInfo);

        Object.defineProperties(meta, {
            id : {
                value : meta.data.id
            }
        }
        );

        return meta;
    }

    /**
     * @param {Object}   metaInfo    Result of mylistgroup/list API
     */
    private static _parse(metaInfo: any|string): MyListMetadataData
    {
        if (metaInfo === "home") {
            const attr = _.defaults({}, MyListMeta.defaults);

            return attr;
        }

        const attr =
        return attr;
    }


    public data: MyListMetadataData

    /**
     * このマイリストが"とりあえずマイリスト"か検証します。
     * @return {boolean}
     *   "とりあえずマイリスト"ならtrueを返します。
     */
    public isDefaultList() {
        return this.attr("id") === "home";
    }


    /**
     * オブジェクトと対応するMyListインスタンスを取得します。
     * @return {Promise}
     */
    public getMyList() {
        return new MyList(this.get("id"));
    }


    /**
     * インスタンスのプロパティを複製します。
     * @return {Object}
     */
    public toJSON() {
        return _.clone(this._attr);
    }
}
