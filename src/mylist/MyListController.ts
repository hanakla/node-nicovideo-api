import _ from "lodash";
import NicoSession from "../NicoSession";
import * as Request from "request-promise";
import * as NicoURL from "../NicoURL";
import NicoException from "../NicoException";
import { MylistSummary } from "../Entity";
import { HomeListSummary } from "../Entity/MylistSummary";
import MyList from "./MyList";

interface MyListToken {
  timestamp: number;
  token: string;
}

// 30秒以上経過したらトークンを取得する
const FETCH_INTERVAL = 30 * 1000;

// トークン抽出用パターン
const tokenRegexp = /NicoAPI.token = "([0-9a-z\-]*)";/;

const parseMylistSummary = (groupItem: any): MylistSummary =>
  Object.freeze({
    id: parseInt(groupItem.id, 10),
    name: groupItem.name,
    description: groupItem.description,
    public: parseInt(groupItem.public, 10) === 1,
    iconId: parseInt(groupItem.icon_id, 10),
    defaultSort: parseInt(groupItem.default_sort, 10),
    sortOrder: parseInt(groupItem.sort_order, 10),
    userId: parseInt(groupItem.user_id, 10),
    createTime: new Date(groupItem.create_time * 1000),
    updateTime: new Date(groupItem.update_time * 1000),
  });

export class MyListController {
  private token: MyListToken | null = null;

  constructor(private session: NicoSession) {
    this.session = session;
  }

  public async fetchToken(): Promise<string> {
    // 一定時間以内に取得したトークンがあればそれを返す
    if (
      this.token != null &&
      Date.now() - this.token.timestamp < FETCH_INTERVAL
    ) {
      return this.token.token;
    }

    // トークン取得
    const res = await Request.get({
      resolveWithFullResponse: true,
      url: NicoURL.MyList.FETCH_TOKEN,
      jar: this.session.cookie,
    });

    // データを取得したらトークンを取り出す
    const token = tokenRegexp.exec(res.body);

    if (token?.[1]) {
      this.token = {
        timestamp: Date.now(),
        token: token[1],
      };

      return token[1];
    } else {
      throw new NicoException({
        message: "NicoMyListApi: Failed to pick token.",
      });
    }
  }

  public async getMyLists(withoutHome: boolean = false): Promise<MyList[]> {
    const res = await Request.get({
      resolveWithFullResponse: true,
      url: NicoURL.MyList.GET_GROUPS,
      jar: this.session.cookie,
    });

    try {
      const result = JSON.parse(res.body);

      if (result.status !== "ok") {
        throw new NicoException({
          message: "Failed to fetch mylist. (reason unknown)",
        });
      }

      const lists = _.map(result.mylistgroup, (json) => {
        const summary = parseMylistSummary(json);
        return new MyList(summary, this.session, this);
      });

      // とりあえずマイリスト
      if (withoutHome === false) {
        lists.push(
          new MyList(
            {
              id: "home",
              name: "とりあえずマイリスト",
              public: false,
            },
            this.session,
            this
          )
        );
      }

      return lists;
    } catch (e) {
      throw new NicoException({
        message: `Failed to fetch mylist. (${e.message})`,
      });
    }
  }
}
