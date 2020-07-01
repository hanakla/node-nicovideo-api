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
import _ from "lodash";

import Request from "request-promise";
import { sprintf } from "sprintf";

import * as NicoUrl from "../NicoURL";
import NicoSession from "../NicoSession";
import NicoException from "../NicoException";
import Emitter, { ListenerOf } from "../Emitter";
import { MylistSummary } from "../Entity";
import MyListItem from "./MyListItem";
import { MyListController } from "./MyListController";
import { HomeListSummary } from "../Entity/MylistSummary";

interface Events {
  "did-refresh": [{ list: MyList }];
  "did-delete-item": [];
}

export default class MyList extends Emitter<Events> implements MylistSummary {
  /**
   * マイリストから項目が削除された時に発火します
   * @event MyList#did-delete-item
   * @property {MyList}        list
   * @property {MyListItem}    item
   */

  public items: MyListItem[] = [];

  constructor(
    private metaInfo: MylistSummary | HomeListSummary,
    private session: NicoSession,
    private controller: MyListController
  ) {
    super();

    Object.defineProperties(this, {
      id: {
        get() {
          return metaInfo.get("id");
        },
      },
      _urlSet: {
        value:
          metaInfo.get("id") === "home"
            ? NicoUrl.MyList.DefList
            : NicoUrl.MyList.Normal,
      },
    });
  }

  public get id() {
    return this.metaInfo.id;
  }
  public get description() {
    return (this.metaInfo as MylistSummary).description;
  }
  public get userId() {
    return (this.metaInfo as MylistSummary).userId;
  }
  public get defaultSort() {
    return (this.metaInfo as MylistSummary).defaultSort;
  }
  public get sortOrder() {
    return (this.metaInfo as MylistSummary).sortOrder;
  }
  public get iconId() {
    return (this.metaInfo as MylistSummary).iconId;
  }
  public get name() {
    return this.metaInfo.name;
  }
  public get public() {
    return this.metaInfo.public;
  }
  public get createTime() {
    return (this.metaInfo as MylistSummary).createTime;
  }
  public get updateTime() {
    return (this.metaInfo as MylistSummary).updateTime;
  }

  /** このマイリストが"とりあえずマイリスト"か */
  public get isDefaultList() {
    return this.id === "home";
  }

  /** マイリストに登録されている動画を取得します。 */
  public async fetch() {
    let res: any;
    try {
      res = await Request.get({
        resolveWithFullResponse: true,
        url: sprintf(this._urlSet.LIST, this.id),
        jar: this.session.cookie,
      });
    } catch (e) {
      Promise.reject(
        new NicoException({
          message: `Failed to fetch items (Connection error: ${e.message})`,
          previous: e,
        })
      );
    }

    let json: any;
    try {
      json = JSON.parse(res.body);
    } catch (e) {
      return Promise.reject(
        new NicoException({
          message: "Failed to parse response",
          response: res.body,
          previous: e,
        })
      );
    }

    if (json.status !== "ok") {
      throw new NicoException({
        message: "Failed to fetch contents (unknown)",
        response: res.body,
      });
    }

    this.items = [];

    _.each(json.mylistitem.reverse(), (item) => {
      const parsedItem = MyListItem.fromApiResponse(item, this);
      return this.items.push(parsedItem);
    });

    this.emit("did-refresh", { list: this });
  }

  /**
   * @private
   * @param {MyListItem|Array.<MyListItem>}    items
   */
  private _pickHavingItemIds(items) {
    let havingItemIds;

    if (!Array.isArray(items)) {
      items = [items];
    }

    const validItems = _.select(items, (item) => item instanceof MyListItem);
    const havingItems = _.select(items, "list", this);
    return (havingItemIds = _.pluck(havingItems, "id"));
  }

  /** マイリストに動画を追加します。 */
  public async addMovieItem(movieId: string, memo: string = "") {
    //-- APIと通信
    // アクセストークンを取得
    const token = await this.controller.fetchToken();

    const res = await Request.post({
      resolveWithFullResponse: true,
      url: this._urlSet.ADD,
      jar: this.session.cookie,
      form: {
        item_type: 0,
        item_id: movieId,
        token,
        description: memo,
        ...(this.isDefaultList ? {} : { group_id: this.id }),
      },
    });

    let result;
    try {
      result = JSON.parse(res.body);
    } catch (e) {
      return Promise.reject(
        "Mylist[%s]: Failed to add item (JSON parse error)"
      );
    }

    if (result.status !== "ok") {
      throw new NicoException({
        message: result.error.description,
        response: result,
      });
    }

    return { response: result };
  }

  /**
   * マイリストから項目を削除します。
   *
   * 渡されたアイテム内のこのリストの項目でないものは無視されます。
   */
  public async deleteItem(items: MyListItem | Array<MyListItem>) {
    const itemIds = this._pickHavingItemIds(items);
    if (itemIds.length === 0) {
      return Promise.resolve({ response: null });
    }

    const token = await this.controller.fetchToken();

    const res = await Request.post({
      resolveWithFullResponse: true,
      url: this._urlSet.DELETE,
      jar: this.session.cookie,
      form: {
        "id_list[0]": itemIds,
        token,
        ...(this.isDefaultList ? {} : { group_id: this.id }),
      },
    });

    let e, result;
    try {
      result = JSON.parse(res.body);
    } catch (error) {
      return Promise.reject(
        new Error("Mylist[%s]: Failed to delete item (JSON parse error)")
      );
    }

    if (result.status === "ok") {
      return Promise.resolve({ response: result });
    } else {
      e = new Error(
        sprintf(
          "MyList[%s]: Failed to delete item (reason: %s)",
          this.id,
          result.error.description
        )
      );

      return Promise.reject(e);
    }
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
  public async moveItem(
    items: MyListItem | Array<MyListItem>,
    targetMyList: MyList
  ) {
    if (!(targetMyList instanceof MyList)) {
      throw new TypeError("targetMyList must be instance of MyList");
    }

    const itemIds = this._pickHavingItemIds(items);
    if (itemIds.length === 0) {
      return Promise.resolve({ response: null });
    }

    const token = await this.controller.fetchToken();

    const res = await Request.post({
      resolveWithFullResponse: true,
      url: this._urlSet.MOVE,
      jar: this.session.cookie,
      form: {
        target_group_id: targetMyList.id,
        "id_list[0]": itemIds,
        token,
        ...(this.isDefaultList ? {} : { group_id: this.id }),
      },
    });

    let result;
    try {
      result = JSON.parse(res.body);
    } catch (error) {
      return Promise.reject(
        "Mylist[%s]: Failed to delete item (JSON parse error)"
      );
    }

    if (result.status === "ok") {
      return { response: result };
    } else {
      throw new Error(
        sprintf(
          "MyList[%s]: Failed to delete item (reason: %s)",
          this.id,
          result.error.description
        )
      );
    }
  }
  //
  // Event Handlers
  //
  public onDidRefresh(listener: ListenerOf<Events["did-refresh"]>) {
    return this.on("did-refresh", listener);
  }

  public onDidDeleteItem(listener: ListenerOf<Events["did-delete-item"]>) {
    return this.on("did-delete-item", listener);
  }
}
