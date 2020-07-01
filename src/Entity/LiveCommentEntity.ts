import { LiveComment } from "./LiveComment";
import deepFreeze from "deep-freeze";
import cheerio from "cheerio";

const ADMIN_USER_ID = 900000000;

const AccountTypes = deepFreeze({
  GENERAL: 0,
  PREMIUM: 1,
  DISTRIBUTOR: 3,
  ADMIN: 6,
});

const REGEXP_LT = /</g;
const REGEXP_GT = />/g;

export default class LiveCommentEntity implements LiveComment {
  /**
   * 規定の形式のXMLからNicoLiveCommentモデルを生成します。
   *
   * ニコ生サーバーから配信されてくる以下のような形式のコメント（１行）を第１引数に渡してください。
   *   <chat thread="##" vpos="##" date="##" date_usec="##" user_id="##" premium="#" locale="**">コメント内容</chat>
   *
   * @param {String} xml ニコ生コメントサーバーから受信したXMLコメントデータ
   * @param {Number} loggedUserId 現在ログイン中のユーザーのID
   * @return {NicoLiveComment}
   */
  public static fromRawXml(xml: string, loggedUserId: string) {
    let ref;
    const $xml = cheerio(xml);
    const props = {
      threadId: $xml.attr("thread"),

      date: new Date(parseInt($xml.attr("date")!, 10) * 1000),
      locale: $xml.attr("locale"),
      command: $xml.attr("mail"),
      comment: $xml.text().replace(REGEXP_GT, ">").replace(REGEXP_LT, "<"),
      vpos: parseInt($xml.attr("vpos"), 10),

      isMyPost:
        $xml.attr("yourpost") === "1" || $xml.attr("user_id") === loggedUserId,

      user: {
        id: /^\d+$/.test((ref = $xml.attr("user_id")))
          ? parseInt(ref, 10)
          : ref,
        score: parseInt($xml.attr("score"), 10),
        accountType: parseInt($xml.attr("premium"), 10),
        isPremium: parseInt($xml.attr("premium"), 10) > 0,
        isAnonymous: parseInt($xml.attr("anonymity"), 10) !== 0,
      },
    };

    return new LiveCommentEntity(props);
  }

  constructor(private _live: LiveComment) {}

  get AccountTypes() {
    return AccountTypes;
  }

  get threadId(): number {
    return this._live.threadId;
  }
  get date(): Date {
    return this._live.date;
  }
  get locale(): string {
    return this._live.locale;
  }
  get command(): string {
    return this._live.command;
  }
  get comment(): string {
    return this._live.comment;
  }
  get vpos(): number {
    return this._live.vpos;
  }

  get isMyPost(): boolean {
    return this._live.isMyPost;
  }
  get user() {
    return this._live.user;
  }

  public isNormalComment(): boolean {
    return !(this.isControlComment() && this.isPostByDistributor());
  }

  public isControlComment(): boolean {
    const userId = this.user.id;
    const accountType = this.user.accountType;
    return userId === ADMIN_USER_ID || accountType === AccountTypes.ADMIN;
  }

  public isPostByDistributor(): boolean {
    return this.user.accountType === AccountTypes.DISTRIBUTOR;
  }

  public isPostBySelf(): boolean {
    return this.isMyPost;
  }

  public isPostByAnonymous() {
    return this.user.isAnonymous;
  }

  public isPostByPremiumUser() {
    return this.user.isPremium;
  }
}
