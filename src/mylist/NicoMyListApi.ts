import * as _ from "lodash"
import * as Request from "request-promise"

import NicoException from '../NicoException'
import NicoSession from '../NicoSession'
import NicoUrl from "../NicoURL"
import MyListMeta from "./MyListMeta"
import MyList from "./MyList"
import {MylistSummary, HomeListSummary} from '../Entity/MylistSummary'

// 30秒以上経過したらトークンを取得する
const FETCH_INTERVAL = 30 * 1000;

// トークン抽出用パターン
const tokenRegexp = /NicoAPI.token = "([0-9a-z\-]*)";/;


const parseMylistSummary = (groupItem: object): MylistSummary => Object.freeze({
    id          : +groupItem.id,
    name        : groupItem.name,
    description : groupItem.description,
    public      : (+groupItem.public) === 1,
    iconId      : +groupItem.icon_id,
    defaultSort : +groupItem.default_sort,
    sortOrder   : +groupItem.sort_order,
    userId      : +groupItem.user_id,
    createTime  : new Date(groupItem.create_time * 1000),
    updateTime  : new Date(groupItem.update_time * 1000)
})

/**
 * マイリストの一覧を取得します。
 *
 * @param    {boolean} withoutHome
 *   trueを指定すると"とりあえずマイリスト"を一覧から除外します。
 * @return   {Promise}
 * - resolve : (mylists: Array.<MyListItemIndex>)
 * - reject : (message: String)
 */
export const fetchOwnedListIndex = async (session: NicoSession, withoutHome: boolean = false): Promise<Array<MylistSummary|HomeListSummary>> =>
{
    const res = await Request.get({
        resolveWithFullResponse : true,
        url   : NicoUrl.MyList.GET_GROUPS,
        jar   : session.cookie
    })

    try {
        const result = JSON.parse(res.body);

        if (result.status !== "ok") {
            throw new NicoException({message: "Failed to fetch mylist. (reason unknown)"})
        }

        const lists: Array<MylistSummary|HomeListSummary> = _.map(result.mylistgroup, parseMylistSummary)

        // とりあえずマイリスト
        if (withoutHome === false) {
            lists.push({
                id: "home",
                name: "とりあえずマイリスト",
                public : false
            });
        }

        return lists
    } catch (e) {
        throw new NicoException({message: `Failed to fetch mylist. (${e.message})`});
    }
}



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

    /** 認証トークン */
    private _token: {
        /** トークンを取得した時間（ミリ秒） */
        timestamp: number
        /** マイリスト操作用トークン */
        token: string
    }|null = null


    /**
     * @constructor
     * @class NicoMyListApi
     * @param {NicoSession}      session
     */
    constructor(private _session: NicoSession) {
        this._session = _session;
    }


    /**
     * マイリストを操作するための認証トークンを取得します。
     * @method fetchToken
     * @return {Promise}
     */
    public async fetchToken(): Promise<string>
    {
        // 一定時間以内に取得したトークンがあればそれを返す
        if (this._token != null && (Date.now() - this._token.timestamp) < FETCH_INTERVAL) {
            return this._token.token
        }

        // トークン取得
        const res = await Request.get({
            resolveWithFullResponse : true,
            url : NicoUrl.MyList.FETCH_TOKEN,
            jar : this._session.cookie
        })

        // データを取得したらトークンを取り出す
        const token = tokenRegexp.exec(res.body);

        if (token?.[1]) {
            this._token = {
                timestamp: Date.now(),
                token: token[1],
            }

            return token[1]
        } else {
            throw new NicoException({message: "NicoMyListApi: Failed to pick token."});
        }
    }


    /**
     * MyListインスタンスを取得します。
     *
     * @method fetchMyList
     * @param    {MyListItemIndex|number} id
     *   MyListItemIndexかマイリストIDを渡します。
     * @return   {Promise(MyList, string)}
     *   取得できればMyListオブジェクトと共にresolveされ、
     *   そうでなければエラーメッセージと共にrejectされます
     */
    public async getHandlerFor(id:'home'|number = 'home') {
        // new Promise((function(resolve, reject) {
        if (id instanceof MyListMeta) {
            return MyList.instanceById(id, this._session)
        }

        if (id !== "home") {
            id = +id
        }

        const metaList = await fetchOwnedListIndex(this._session, false)
        const meta = _.find<MyListMeta>(metaList, {id});

        if (!meta) {
            throw new NicoException(`Can't find specified mylist.(${id})`)
        }

        const mylist = MyList.instanceById(meta[0], this._session))
        mylist.
    }
};
